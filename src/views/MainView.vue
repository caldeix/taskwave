<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Inbox, Layers, Plus } from 'lucide-vue-next'
import MonthCalendar from '@/components/calendar/MonthCalendar.vue'
import UndatedPanel from '@/components/calendar/UndatedPanel.vue'
import ViewSwitch from '@/components/layout/ViewSwitch.vue'
import ProjectIcon from '@/components/projects/ProjectIcon.vue'
import NewTaskDialog from '@/components/tasks/NewTaskDialog.vue'
import StartedStrip from '@/components/tasks/StartedStrip.vue'
import FiltersBar from '@/components/filters/FiltersBar.vue'
import KanbanBoard from '@/components/kanban/KanbanBoard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { useLiveTasks } from '@/composables/useLiveTasks'
import { useLiveWorklogs } from '@/composables/useLiveWorklogs'
import { closedSinceQuery, openQuery, rangeQueries, undatedQuery } from '@/data/taskQueries'
import { CLOSED_WINDOWS, closedSinceMs, nextClosedWindow, type ClosedWindow } from '@/domain/kanban'
import type { TaskStatus } from '@/domain/status'
import {
  formatMonthParam,
  gridRange,
  monthGrid,
  parseMonthParam,
  shiftMonth,
} from '@/domain/calendar'
import { todayKey, type DayKey } from '@/domain/dates'
import { PROJECT_COLOR_CLASSES, type Project } from '@/domain/projects'
import type { Task, TaskScope } from '@/domain/task'
import { viewFromQuery, viewToQuery, type MainView } from '@/domain/views'
import { db } from '@/lib/firebase'
import { applyFilters, sortTasks } from '@/domain/filters'
import { minutesPerDay } from '@/domain/stats'
import { useAuthStore } from '@/stores/auth'
import { useFiltersStore } from '@/stores/filters'
import { useProfileStore } from '@/stores/profile'
import { useProjectsStore } from '@/stores/projects'
import { useTasksStore } from '@/stores/tasks'
import { useToastsStore } from '@/stores/toasts'
import { useUiStore } from '@/stores/ui'

/**
 * Vista principal: «Todos», «Sin proyecto» o un proyecto (step-8), en modo calendario
 * (step-11) o kanban (step-12).
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

// ---- Datos en vivo: tareas de la rejilla del mes y sin fecha (steps 9 y 11) ----
const taskScope = computed<TaskScope | null>(() => {
  if (props.scope === 'all') return { kind: 'all' }
  if (props.scope === 'inbox') return { kind: 'inbox' }
  return project.value ? { kind: 'project', projectId: project.value.id } : null
})
const uid = computed(() => authStore.user?.uid ?? null)
const scopeKey = computed(() => JSON.stringify(taskScope.value))

/** Mes del calendario en la URL (`?mes=2026-11`); por defecto, el actual. */
const month = computed(() => parseMonthParam(route.query.mes))
const visibleRange = computed(() => gridRange(monthGrid(month.value)))

// Horas registradas de cada día del calendario, en el ámbito de la vista (step-24, D-52).
const gridLogs = useLiveWorklogs(() =>
  uid.value && view.value === 'calendar' ? { uid: uid.value, range: visibleRange.value } : null,
)
const hoursByDay = computed(() =>
  taskScope.value ? minutesPerDay(gridLogs.value, taskScope.value) : {},
)
const today = ref<DayKey>(todayKey())

// Cada vista escucha solo sus consultas, para no gastar lecturas en la que no se ve.
const { tasks: gridTasks } = useLiveTasks(() =>
  view.value === 'calendar' && uid.value && taskScope.value
    ? {
        key: `grid:${uid.value}:${scopeKey.value}:${visibleRange.value.from}`,
        queries: rangeQueries(db, uid.value, visibleRange.value, taskScope.value),
      }
    : null,
)
const { tasks: undatedTasks } = useLiveTasks(() =>
  view.value === 'calendar' && uid.value && taskScope.value
    ? {
        key: `undated:${uid.value}:${scopeKey.value}`,
        queries: [undatedQuery(db, uid.value, taskScope.value)],
      }
    : null,
)

// ---- Kanban (step-12): abiertas + cerradas del periodo (D-36) ----
const closedWindow = ref<ClosedWindow>(CLOSED_WINDOWS[0])
const { tasks: boardTasks } = useLiveTasks(() =>
  view.value === 'kanban' && uid.value && taskScope.value
    ? {
        key: `board:${uid.value}:${scopeKey.value}:${closedWindow.value}`,
        queries: [
          openQuery(db, uid.value, taskScope.value),
          closedSinceQuery(db, uid.value, taskScope.value, closedSinceMs(closedWindow.value)),
        ],
      }
    : null,
)

// ---- Filtros (step-13): se aplican en el cliente sobre lo ya leído ----
const filtersStore = useFiltersStore()
/** En el calendario, el periodo es el mes visible y «Sin fecha» no aplica (D-39). */
const calendarFilters = computed(() => ({
  ...filtersStore.filters,
  quick: filtersStore.filters.quick === 'undated' ? ('none' as const) : filtersStore.filters.quick,
}))
const calendarTasks = computed(() =>
  applyFilters(gridTasks.value, calendarFilters.value, { today: today.value, ignorePeriod: true }),
)
const undatedVisible = computed(() =>
  applyFilters(undatedTasks.value, calendarFilters.value, {
    today: today.value,
    ignorePeriod: true,
  }),
)
const boardVisible = computed(() =>
  applyFilters(boardTasks.value, filtersStore.filters, { today: today.value }),
)
function kanbanSorter(tasks: Task[]): Task[] {
  return sortTasks(tasks, filtersStore.filters.sort, filtersStore.filters.sortDir)
}

/** En «Todos» cada tarjeta muestra su proyecto; dentro de un proyecto no hace falta. */
function projectOf(task: Task): Project | undefined {
  return props.scope === 'all' && task.projectId ? projectsStore.byId(task.projectId) : undefined
}

/** Nombre del proyecto en la franja de iniciadas de «Todos». */
function projectName(projectId: string | null): string {
  return projectId ? (projectsStore.byId(projectId)?.name ?? '') : t('nav.inbox')
}

async function setStatus(task: Task, status: TaskStatus): Promise<void> {
  try {
    await tasksStore.setStatus(task, status)
  } catch {
    toasts.show(t('kanban.moveFailed', { key: task.key }), 'error')
  }
}

function changeMonth(delta: number): void {
  void router.replace({
    query: { ...route.query, mes: formatMonthParam(shiftMonth(month.value, delta)) },
  })
}

function goToday(): void {
  today.value = todayKey()
  const query = { ...route.query }
  delete query.mes
  void router.replace({ query })
}

// ---- Alta (step-10) y alta rápida en el calendario (D-22) ----
/** En un proyecto se crea en él; en «Todos» y «Sin proyecto», en la bandeja (D-11). */
const defaultProjectId = computed(() =>
  props.scope === 'project' ? (project.value?.id ?? null) : null,
)
const newTask = ref<{ startDate: DayKey | null; title: string } | null>(null)

// Atajo `N` o «Nueva tarea» del buscador (step-24): abre el formulario aquí.
const ui = useUiStore()
watch(
  () => ui.newTaskRequested,
  (requested) => {
    if (requested && ui.takeNewTaskRequest()) newTask.value = { startDate: today.value, title: '' }
  },
  { immediate: true },
)
const creating = ref(false)

async function quickCreate(day: DayKey, taskTitle: string): Promise<void> {
  creating.value = true
  try {
    const created = await tasksStore.create({
      title: taskTitle,
      projectId: defaultProjectId.value,
      startDate: day,
      endDate: null,
      priority: 'medium',
    })
    toasts.show(t('tasks.created', { key: created.key }))
  } catch {
    toasts.show(t('tasks.new.failed'), 'error')
  } finally {
    creating.value = false
  }
}

// ---- Mover de día (D-21) ----
async function moveTask(
  task: Task,
  dates: { startDate: DayKey; endDate: DayKey | null },
): Promise<void> {
  try {
    await tasksStore.setDates(task, dates)
  } catch {
    toasts.show(t('calendar.moveFailed', { key: task.key }), 'error')
  }
}

/** Abre la vista de la tarea (step-14, D-23). */
function openTask(task: Task): void {
  void router.push({ name: 'task', params: { taskKey: task.key } })
}

// ---- Borrado (step-10), desde el menú de las tarjetas del kanban ----
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
          <BaseButton @click="newTask = { startDate: today, title: '' }">
            <Plus class="h-4 w-4" aria-hidden="true" />
            {{ t('tasks.newButton') }}
          </BaseButton>
        </div>
      </header>

      <!-- Tareas iniciadas (step-21, D-34) -->
      <StartedStrip
        v-if="taskScope"
        :scope="taskScope"
        :show-project="scope === 'all' ? projectName : undefined"
      />

      <FiltersBar :view="view" />

      <!-- Calendario mensual con el panel «Sin fecha» (step-11) -->
      <div
        v-if="view === 'calendar'"
        class="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_17rem]"
      >
        <MonthCalendar
          :month="month"
          :tasks="calendarTasks"
          :today="today"
          :creating="creating"
          :minutes-by-day="hoursByDay"
          @move="moveTask"
          @quick-create="quickCreate"
          @open-new="(day, text) => (newTask = { startDate: day, title: text })"
          @open-task="openTask"
          @change-month="changeMonth"
          @go-today="goToday"
        />
        <UndatedPanel :tasks="undatedVisible" @open-task="openTask" />
      </div>

      <!-- Kanban (step-12) -->
      <KanbanBoard
        v-else
        :tasks="boardVisible"
        :today="today"
        :project-of="projectOf"
        :closed-window="closedWindow"
        :sorter="kanbanSorter"
        :hidden-statuses="filtersStore.filters.hiddenStatuses"
        @move="setStatus"
        @open="openTask"
        @delete="deleting = $event"
        @more-closed="closedWindow = nextClosedWindow(closedWindow)"
      />
    </template>

    <NewTaskDialog
      :open="newTask !== null"
      :project-id="defaultProjectId"
      :start-date="newTask?.startDate ?? null"
      :title="newTask?.title ?? ''"
      @close="newTask = null"
      @created="newTask = null"
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
