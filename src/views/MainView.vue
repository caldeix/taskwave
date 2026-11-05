<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { CalendarDays, Columns3, Inbox, Layers, Plus } from 'lucide-vue-next'
import ViewSwitch from '@/components/layout/ViewSwitch.vue'
import ProjectIcon from '@/components/projects/ProjectIcon.vue'
import NewTaskDialog from '@/components/tasks/NewTaskDialog.vue'
import ProvisionalTaskList from '@/components/tasks/ProvisionalTaskList.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { PROJECT_COLOR_CLASSES } from '@/domain/projects'
import { viewFromQuery, viewToQuery, type MainView } from '@/domain/views'
import { endOfMonth, startOfMonth } from 'date-fns'
import { useLiveTasks } from '@/composables/useLiveTasks'
import { rangeQueries, undatedQuery } from '@/data/taskQueries'
import { toDayKey, todayKey } from '@/domain/dates'
import type { Task, TaskScope } from '@/domain/task'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { useProjectsStore } from '@/stores/projects'
import { useTasksStore } from '@/stores/tasks'
import { useToastsStore } from '@/stores/toasts'

/**
 * Vista principal (step-8): «Todos», «Sin proyecto» o un proyecto, en modo calendario o kanban.
 * El calendario (step-11) y el kanban (step-12) sustituirán al marcador provisional.
 */
const props = defineProps<{ scope: 'all' | 'inbox' | 'project' }>()

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const profileStore = useProfileStore()
const projectsStore = useProjectsStore()
const tasksStore = useTasksStore()
const toasts = useToastsStore()

const project = computed(() =>
  props.scope === 'project'
    ? projectsStore.byKey(String(route.params.projectKey ?? ''))
    : undefined,
)
const notFound = computed(() => props.scope === 'project' && projectsStore.loaded && !project.value)

const view = computed<MainView>(() => viewFromQuery(route.query.vista, profileStore.prefs.view))

// ---- Datos (step-9): tareas del mes actual y sin fecha del ámbito, en vivo ----
const taskScope = computed<TaskScope | null>(() => {
  if (props.scope === 'all') return { kind: 'all' }
  if (props.scope === 'inbox') return { kind: 'inbox' }
  return project.value ? { kind: 'project', projectId: project.value.id } : null
})
const monthRange = computed(() => {
  const now = new Date()
  return { from: toDayKey(startOfMonth(now)), to: toDayKey(endOfMonth(now)) }
})
const uid = computed(() => authStore.user?.uid ?? null)
const scopeKey = computed(() => JSON.stringify(taskScope.value))

const { tasks: monthTasks, loading: monthLoading } = useLiveTasks(() =>
  uid.value && taskScope.value
    ? {
        key: `month:${uid.value}:${scopeKey.value}:${monthRange.value.from}`,
        queries: rangeQueries(db, uid.value, monthRange.value, taskScope.value),
      }
    : null,
)
const { tasks: undatedTasks, loading: undatedLoading } = useLiveTasks(() =>
  uid.value && taskScope.value
    ? {
        key: `undated:${uid.value}:${scopeKey.value}`,
        queries: [undatedQuery(db, uid.value, taskScope.value)],
      }
    : null,
)
const liveLoading = computed(() => monthLoading.value || undatedLoading.value)

// ---- Alta y borrado (step-10) ----
const newTaskOpen = ref(false)
/** En un proyecto se crea en él; en «Todos» y «Sin proyecto», en la bandeja (D-11). */
const defaultProjectId = computed(() =>
  props.scope === 'project' ? (project.value?.id ?? null) : null,
)

const listedTasks = computed(() => {
  const merged = new Map<string, Task>()
  for (const task of [...monthTasks.value, ...undatedTasks.value]) merged.set(task.id, task)
  return [...merged.values()]
})

const deleting = ref<Task | null>(null)
const deletingBusy = ref(false)

async function confirmDelete(): Promise<void> {
  const task = deleting.value
  if (!task) return
  deletingBusy.value = true
  try {
    await tasksStore.remove(task)
    toasts.show(t('tasks.deleted', { key: task.key }))
  } catch {
    toasts.show(t('tasks.deleteFailed'), 'error')
  } finally {
    deletingBusy.value = false
    deleting.value = null
  }
}

function setView(next: MainView): void {
  void router.replace({ query: { ...route.query, vista: viewToQuery(next) } })
  void profileStore.updatePrefs({ view: next })
}

const title = computed(() => {
  if (props.scope === 'all') return t('nav.all')
  if (props.scope === 'inbox') return t('nav.inbox')
  return project.value?.name ?? ''
})

const subtitle = computed(() => {
  if (props.scope === 'all') return t('views.allSubtitle')
  if (props.scope === 'inbox') return t('views.inboxSubtitle')
  return project.value ? t('views.projectSubtitle', { key: project.value.key }) : ''
})
</script>

<template>
  <main class="flex min-w-0 flex-1 flex-col gap-6 px-4 py-6 md:px-8">
    <p v-if="notFound" class="m-0 font-text text-base text-gray-500 dark:text-gray-400">
      {{ t('views.projectNotFound') }}
    </p>

    <template v-else>
      <header class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div class="flex min-w-0 items-center gap-3">
          <span
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800"
          >
            <Layers
              v-if="scope === 'all'"
              class="h-6 w-6 text-blue-600 dark:text-blue-400"
              aria-hidden="true"
            />
            <Inbox
              v-else-if="scope === 'inbox'"
              class="h-6 w-6 text-gray-500 dark:text-gray-400"
              aria-hidden="true"
            />
            <ProjectIcon
              v-else-if="project"
              :name="project.icon"
              :class="['h-6 w-6', PROJECT_COLOR_CLASSES[project.color].text]"
            />
          </span>
          <div class="flex min-w-0 flex-col">
            <h1
              class="m-0 w-fit max-w-full truncate bg-radial-blue bg-clip-text font-title text-4xl leading-tight font-semibold text-transparent"
            >
              {{ title }}
            </h1>
            <p class="m-0 text-sm text-gray-500 dark:text-gray-400">{{ subtitle }}</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <ViewSwitch :model-value="view" @update:model-value="setView" />
          <BaseButton @click="newTaskOpen = true">
            <Plus class="h-4 w-4" aria-hidden="true" />
            {{ t('tasks.newButton') }}
          </BaseButton>
        </div>
      </header>

      <!-- Marcador provisional hasta los steps 11 (calendario) y 12 (kanban) -->
      <section
        class="flex min-h-80 flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-500 p-8 text-center dark:border-gray-400"
      >
        <CalendarDays
          v-if="view === 'calendar'"
          class="h-10 w-10 text-gray-500 dark:text-gray-400"
          aria-hidden="true"
        />
        <Columns3 v-else class="h-10 w-10 text-gray-500 dark:text-gray-400" aria-hidden="true" />
        <p class="m-0 font-text text-sm text-gray-500 dark:text-gray-400">
          {{ view === 'calendar' ? t('views.calendarSoon') : t('views.kanbanSoon') }}
        </p>
        <!-- Provisional (step-9): comprueba la capa de datos hasta que llegue el calendario -->
        <p class="m-0 font-text text-sm font-medium text-gray-800 dark:text-white" role="status">
          <template v-if="liveLoading">{{ t('views.loadingTasks') }}</template>
          <template v-else>
            {{ t('views.taskSummary', { month: monthTasks.length, undated: undatedTasks.length }) }}
          </template>
        </p>
      </section>

      <ProvisionalTaskList :tasks="listedTasks" @delete="deleting = $event" />
    </template>

    <NewTaskDialog
      :open="newTaskOpen"
      :project-id="defaultProjectId"
      :start-date="todayKey()"
      @close="newTaskOpen = false"
      @created="newTaskOpen = false"
    />
    <ConfirmDialog
      :open="deleting !== null"
      :title="t('tasks.confirmDelete.title')"
      :message="
        deleting
          ? t('tasks.confirmDelete.message', { key: deleting.key, title: deleting.title })
          : ''
      "
      :confirm-label="t('tasks.confirmDelete.confirm')"
      :cancel-label="t('common.cancel')"
      :busy="deletingBusy"
      @confirm="confirmDelete"
      @cancel="deleting = null"
    />
  </main>
</template>
