<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  ArrowLeft,
  Command as CommandIcon,
  Copy,
  PanelRightClose,
  PanelRightOpen,
  Trash2,
} from 'lucide-vue-next'
import TaskDescription from '@/components/task/TaskDescription.vue'
import TaskDetailsPanel from '@/components/task/TaskDetailsPanel.vue'
import TaskRelations from '@/components/task/TaskRelations.vue'
import TaskTabs from '@/components/task/TaskTabs.vue'
import SaveTemplateDialog from '@/components/task/SaveTemplateDialog.vue'
import TaskTitle from '@/components/task/TaskTitle.vue'
import ProjectIcon from '@/components/projects/ProjectIcon.vue'
import CommandPalette from '@/components/ui/CommandPalette.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { useLiveTasks } from '@/composables/useLiveTasks'
import { useRelatedTasks } from '@/composables/useRelatedTasks'
import { taskByKeyQuery } from '@/data/taskQueries'
import type { Command } from '@/domain/commands'
import { PROJECT_COLOR_CLASSES } from '@/domain/projects'
import { isTypingTarget } from '@/domain/shortcuts'
import { TASK_STATUSES, isClosedStatus } from '@/domain/status'
import { PRIORITIES, type Task } from '@/domain/task'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/stores/auth'
import { useProjectsStore } from '@/stores/projects'
import { useTasksStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
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

// ---- Paleta de comandos con «.» (v1.1.0, idea 3, D-4) ----
const timer = useTimerStore()
const relations = ref<InstanceType<typeof TaskRelations> | null>(null)
const paletteOpen = ref(false)
const savingTemplate = ref(false)

async function guarded(action: () => Promise<unknown>): Promise<void> {
  try {
    await action()
  } catch (error) {
    if (!(error instanceof Error && error.message === 'timer-stop-failed'))
      toasts.show(t('taskView.saveFailed'), 'error')
  }
}

const commands = computed<Command[]>(() => {
  const current = task.value
  if (!current) return []
  const list: Command[] = []
  const group = (key: string) => t(`commands.groups.${key}`)
  for (const status of TASK_STATUSES)
    if (status !== current.status)
      list.push({
        id: `status:${status}`,
        group: group('status'),
        label: t(`status.${status}`),
        run: () => guarded(() => tasksStore.setStatus(current, status)),
      })
  for (const priority of PRIORITIES)
    if (priority !== current.priority)
      list.push({
        id: `priority:${priority}`,
        group: group('priority'),
        label: t(`tasks.priority.${priority}`),
        run: () => guarded(() => tasksStore.updateFields(current, { priority })),
      })
  const running = timer.isRunningOn(current.id)
  list.push({
    id: 'timer',
    group: group('task'),
    label: running ? t('commands.stopTimer') : t('commands.startTimer'),
    keywords: 'cronometro reloj tiempo',
    disabled: !running && isClosedStatus(current.status),
    run: () => (running ? timer.requestStop() : timer.requestStart(current)),
  })
  list.push(
    {
      id: 'link',
      group: group('task'),
      label: t('commands.link'),
      keywords: 'vinculo relacion',
      run: () => {
        relations.value?.startLinking()
      },
    },
    {
      id: 'subtask',
      group: group('task'),
      label: t('commands.subtask'),
      disabled: !!current.parentId,
      run: () => {
        relations.value?.focusSubtask()
      },
    },
    {
      id: 'comment',
      group: group('task'),
      label: t('commands.comment'),
      run: () => {
        document.querySelector<HTMLButtonElement>('[data-command="add-comment"]')?.click()
      },
    },
    {
      id: 'copy-link',
      group: group('task'),
      label: t('commands.copyLink'),
      keywords: 'url compartir',
      run: async () => {
        try {
          await navigator.clipboard.writeText(window.location.href)
          toasts.show(t('commands.copied'))
        } catch {
          toasts.show(t('commands.copyFailed'), 'error')
        }
      },
    },
    {
      id: 'duplicate',
      group: group('task'),
      label: t('tasks.duplicate'),
      keywords: 'copiar',
      run: duplicate,
    },
    {
      id: 'template',
      group: group('task'),
      label: t('templates.saveTitle'),
      keywords: 'plantilla modelo',
      run: () => {
        savingTemplate.value = true
      },
    },
    {
      id: 'delete',
      group: group('task'),
      label: t('common.delete'),
      keywords: 'eliminar borrar papelera',
      run: () => {
        deleting.value = true
      },
    },
  )
  if (current.projectId !== null)
    list.push({
      id: 'project:inbox',
      group: group('project'),
      label: t('nav.inbox'),
      run: () => moveProject(null),
    })
  for (const p of projectsStore.active)
    if (p.id !== current.projectId)
      list.push({
        id: `project:${p.id}`,
        group: group('project'),
        label: p.name,
        run: () => moveProject(p.id),
      })
  return list
})

/** «.» abre la paleta si no se está escribiendo ni hay otro diálogo abierto. */
function onKeydown(event: KeyboardEvent): void {
  if (event.key !== '.' || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return
  if (isTypingTarget(event.target) || document.querySelector('dialog[open]')) return
  if (!task.value) return
  event.preventDefault()
  paletteOpen.value = true
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

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
          :aria-label="t('commands.open')"
          :title="t('commands.open')"
          aria-keyshortcuts="."
          @click="paletteOpen = true"
        >
          <CommandIcon class="h-4 w-4" aria-hidden="true" />
        </button>
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
          ref="relations"
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

    <SaveTemplateDialog
      :open="savingTemplate"
      :task="task"
      :subtasks="related.subtasks.value"
      @close="savingTemplate = false"
    />
    <CommandPalette
      :open="paletteOpen"
      :commands="commands"
      :title="shown ? t('commands.title', { key: shown.key }) : ''"
      @close="paletteOpen = false"
    />
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
