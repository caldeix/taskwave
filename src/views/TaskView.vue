<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, Copy, PanelRightClose, PanelRightOpen, Trash2 } from 'lucide-vue-next'
import TaskDescription from '@/components/task/TaskDescription.vue'
import TaskDetailsPanel from '@/components/task/TaskDetailsPanel.vue'
import TaskRelations from '@/components/task/TaskRelations.vue'
import TaskTabs from '@/components/task/TaskTabs.vue'
import TaskTitle from '@/components/task/TaskTitle.vue'
import ProjectIcon from '@/components/projects/ProjectIcon.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { useLiveTasks } from '@/composables/useLiveTasks'
import { useRelatedTasks } from '@/composables/useRelatedTasks'
import { taskByKeyQuery } from '@/data/taskQueries'
import { PROJECT_COLOR_CLASSES } from '@/domain/projects'
import type { Task } from '@/domain/task'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/stores/auth'
import { useProjectsStore } from '@/stores/projects'
import { useTasksStore } from '@/stores/tasks'
import { useToastsStore } from '@/stores/toasts'

/**
 * Vista de una tarea (step-14, D-23): sustituye al calendario o al kanban, tiene su URL
 * (`/t/EST-12`) y el panel de datos a la derecha, plegable. La descripción es markdown
 * (step-15), con sus vínculos y subtareas (step-16) y sus comentarios (step-18); el registro de
 * horas y la actividad llegan en los steps 20 y 22.
 */
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const projectsStore = useProjectsStore()
const tasksStore = useTasksStore()
const toasts = useToastsStore()

const taskKey = computed(() => String(route.params.taskKey ?? ''))
const uid = computed(() => authStore.user?.uid ?? null)

const { tasks, loading } = useLiveTasks(() =>
  uid.value && taskKey.value
    ? {
        key: `task:${uid.value}:${taskKey.value}`,
        queries: [taskByKeyQuery(db, uid.value, taskKey.value)],
      }
    : null,
)
const task = computed(() => tasks.value[0] ?? null)
const project = computed(() =>
  shown.value?.projectId ? projectsStore.byId(shown.value.projectId) : undefined,
)

const panelOpen = ref(true)
const savingTitle = ref(false)

/** «Volver»: a la página anterior de la app o, si se entró directamente, a «Todos». */
function goBack(): void {
  if (window.history.state?.back) router.back()
  else void router.push({ name: 'home' })
}

async function saveTitle(title: string): Promise<void> {
  if (!task.value) return
  savingTitle.value = true
  try {
    await tasksStore.updateFields(task.value, { title })
  } catch {
    toasts.show(t('taskView.saveFailed'), 'error')
  } finally {
    savingTitle.value = false
  }
}

/**
 * Mover de proyecto cambia la clave (D-12). Mientras dura, se sigue mostrando la tarea (la
 * consulta por la clave antigua se queda vacía) y después se cambia la URL sin añadir historial.
 */
const moving = ref<Task | null>(null)
const shown = computed(() => task.value ?? moving.value)

/** Subtareas, padre y vinculadas (step-16). */
const related = useRelatedTasks(() => shown.value)

async function moveProject(projectId: string | null): Promise<void> {
  if (!task.value) return
  moving.value = task.value
  try {
    const key = await tasksStore.moveToProject(task.value, projectId)
    if (key) {
      toasts.show(t('taskView.movedProject', { key }))
      await router.replace({ name: 'task', params: { taskKey: key } })
    }
  } catch {
    toasts.show(t('taskView.saveFailed'), 'error')
  } finally {
    moving.value = null
  }
}

/** Duplicar (step-24, D-52): crea la copia y la abre. */
const duplicating = ref(false)
async function duplicate(): Promise<void> {
  if (!task.value || duplicating.value) return
  duplicating.value = true
  const from = task.value.key
  try {
    const { key } = await tasksStore.duplicate(task.value)
    toasts.show(t('tasks.duplicated', { key, from }))
    await router.push({ name: 'task', params: { taskKey: key } })
  } catch {
    toasts.show(t('tasks.duplicateFailed'), 'error')
  } finally {
    duplicating.value = false
  }
}

const deleting = ref(false)
const deleteBusy = ref(false)
async function confirmDelete(): Promise<void> {
  if (!task.value) return
  const { key } = task.value
  deleteBusy.value = true
  try {
    await tasksStore.remove(task.value)
    toasts.show(t('tasks.deleted', { key }))
    deleting.value = false
    goBack()
  } catch {
    toasts.show(t('tasks.deleteFailed'), 'error')
  } finally {
    deleteBusy.value = false
  }
}

const iconButton =
  'inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-gray-500 transition hover:bg-gray-200 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white'
</script>

<template>
  <main class="flex min-w-0 flex-1 flex-col gap-4 px-4 py-6 md:px-8">
    <!-- Barra superior: volver, clave y acciones -->
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-transparent px-2 font-text text-sm font-bold text-blue-600 transition hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-blue-400 dark:hover:bg-gray-800"
        @click="goBack"
      >
        <ArrowLeft class="h-4 w-4" aria-hidden="true" />
        {{ t('taskView.back') }}
      </button>
      <span v-if="shown" class="font-text text-sm font-bold text-gray-500 dark:text-gray-400">{{
        shown.key
      }}</span>
      <RouterLink
        v-if="project"
        :to="{ name: 'project', params: { projectKey: project.key } }"
        class="inline-flex min-w-0 items-center gap-1 font-text text-sm text-gray-500 no-underline hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
      >
        <ProjectIcon
          :name="project.icon"
          :class="['h-4 w-4', PROJECT_COLOR_CLASSES[project.color].text]"
        />
        <span class="truncate">{{ project.name }}</span>
      </RouterLink>
      <div v-if="shown" class="ml-auto flex items-center gap-1">
        <button
          type="button"
          :class="iconButton"
          :aria-label="t('tasks.duplicate')"
          :title="t('tasks.duplicate')"
          :disabled="duplicating"
          @click="duplicate"
        >
          <Copy class="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          :class="iconButton"
          :aria-label="t('common.delete')"
          :title="t('common.delete')"
          @click="deleting = true"
        >
          <Trash2 class="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          :class="[iconButton, 'hidden lg:inline-flex']"
          :aria-label="panelOpen ? t('taskView.hidePanel') : t('taskView.showPanel')"
          :title="panelOpen ? t('taskView.hidePanel') : t('taskView.showPanel')"
          :aria-expanded="panelOpen"
          @click="panelOpen = !panelOpen"
        >
          <PanelRightClose v-if="panelOpen" class="h-4 w-4" aria-hidden="true" />
          <PanelRightOpen v-else class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>

    <p v-if="loading && !shown" class="m-0 font-text text-sm text-gray-500 dark:text-gray-400">
      {{ t('taskView.loading') }}
    </p>
    <div v-else-if="!shown" class="flex flex-col items-start gap-2">
      <p class="m-0 font-text text-base text-gray-800 dark:text-white">
        {{ t('taskView.notFound', { key: taskKey }) }}
      </p>
    </div>

    <div
      v-else
      :class="[
        'grid min-w-0 grid-cols-1 gap-8',
        panelOpen ? 'lg:grid-cols-[minmax(0,1fr)_20rem]' : '',
      ]"
    >
      <!-- Contenido: título, descripción, vínculos y pestañas -->
      <article class="flex min-w-0 flex-col gap-6">
        <TaskTitle :title="shown.title" :disabled="savingTitle" @save="saveTitle" />

        <TaskDescription :task="shown" />

        <TaskRelations
          :task="shown"
          :by-id="related.byId.value"
          :parent="related.parent.value"
          :subtasks="related.subtasks.value"
          :totals="related.totals.value"
          :loading="related.loading.value"
        />

        <TaskTabs :task="shown" />
      </article>

      <TaskDetailsPanel
        v-show="panelOpen"
        :task="shown"
        :totals="related.totals.value"
        class="lg:border-l lg:border-gray-200 lg:pl-6 dark:lg:border-gray-700"
        @move-project="moveProject"
      />
    </div>

    <ConfirmDialog
      :open="deleting"
      :title="t('tasks.confirmDelete.title')"
      :message="
        shown ? t('tasks.confirmDelete.message', { key: shown.key, title: shown.title }) : ''
      "
      :confirm-label="t('tasks.confirmDelete.confirm')"
      :cancel-label="t('common.cancel')"
      :busy="deleteBusy"
      @confirm="confirmDelete"
      @cancel="deleting = false"
    />
  </main>
</template>
