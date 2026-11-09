<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ArrowRight,
  Ban,
  CalendarClock,
  Clock,
  Copy,
  ListChecks,
  SquareCheck,
  Trash2,
} from 'lucide-vue-next'
import PriorityIcon from '@/components/tasks/PriorityIcon.vue'
import TagChip from '@/components/tags/TagChip.vue'
import DropdownMenu, { type MenuItem } from '@/components/ui/DropdownMenu.vue'
import { fromDayKey, type DayKey } from '@/domain/dates'
import { formatHours } from '@/domain/duration'
import { isOverdue } from '@/domain/kanban'
import type { CardProgress } from '@/domain/progress'
import { PROJECT_COLOR_CLASSES, type Project } from '@/domain/projects'
import { TASK_STATUSES, isClosedStatus, type TaskStatus } from '@/domain/status'
import type { Task } from '@/domain/task'
import { tagsOf } from '@/domain/tags'
import { useTaskDrag } from '@/composables/useTaskDrag'
import { useTagsStore } from '@/stores/tags'

/**
 * Tarjeta del kanban (step-12): clave, título, prioridad, proyecto (en «Todos»), fechas y tags
 * (step-17), con las atrasadas en coral (D-35). Se arrastra a otra columna o se mueve desde su menú.
 * Con `progress` (v1.1.0) muestra subtareas, casillas, horas y si la bloquea otra tarea abierta.
 */
const props = defineProps<{
  task: Task
  today: DayKey
  project?: Project
  progress?: CardProgress
}>()
const emit = defineEmits<{ open: []; move: [status: TaskStatus]; duplicate: []; delete: [] }>()

const { t, locale } = useI18n()
const { start, end } = useTaskDrag()

const tagsStore = useTagsStore()
const MAX_CARD_TAGS = 3
const tags = computed(() => tagsOf(props.task.tagIds, tagsStore.all))

const overdue = computed(() => isOverdue(props.task, props.today))
const closed = computed(() => isClosedStatus(props.task.status))

const shortDate = computed(
  () => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short' }),
)
const dates = computed(() => {
  const { startDate, endDate } = props.task
  if (!startDate) return null
  const from = shortDate.value.format(fromDayKey(startDate))
  // Un fin igual al inicio es una tarea de un día: solo se muestra una fecha.
  return endDate && endDate !== startDate
    ? `${from} → ${shortDate.value.format(fromDayKey(endDate))}`
    : from
})

const hoursText = computed(() => {
  const h = props.progress?.hours
  if (!h) return ''
  return h.estimateMin !== null
    ? `${formatHours(h.spentMin)} / ${formatHours(h.estimateMin)}`
    : formatHours(h.spentMin)
})
const overEstimate = computed(() => {
  const h = props.progress?.hours
  return !!h && h.estimateMin !== null && h.spentMin > h.estimateMin
})

const menu = computed<MenuItem[]>(() => [
  ...TASK_STATUSES.filter((s) => s !== props.task.status).map((s) => ({
    key: `move:${s}`,
    label: t('kanban.moveTo', { status: t(`status.${s}`) }),
    icon: ArrowRight,
  })),
  { key: 'duplicate', label: t('tasks.duplicate'), icon: Copy },
  { key: 'delete', label: t('common.delete'), icon: Trash2, danger: true },
])

function onMenu(key: string): void {
  if (key === 'delete') emit('delete')
  else if (key === 'duplicate') emit('duplicate')
  else emit('move', key.slice(5) as TaskStatus)
}
</script>

<template>
  <article
    draggable="true"
    :class="[
      'group flex cursor-grab flex-col gap-2 rounded-lg border bg-white p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing dark:bg-gray-900',
      overdue ? 'border-coral-500' : 'border-gray-200 dark:border-gray-700',
      closed ? 'opacity-75' : '',
    ]"
    @dragstart="start($event, task, null)"
    @dragend="end"
  >
    <div class="flex items-start gap-2">
      <button
        type="button"
        class="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        @click="emit('open')"
      >
        <span class="block font-text text-xs font-bold text-gray-500 dark:text-gray-400">{{
          task.key
        }}</span>
        <span
          :class="[
            'block font-text text-sm leading-snug font-medium break-words text-gray-800 dark:text-white',
            task.status === 'discarded' ? 'line-through' : '',
          ]"
        >
          {{ task.title }}
        </span>
      </button>
      <DropdownMenu
        :label="t('kanban.cardActions', { key: task.key })"
        :items="menu"
        @select="onMenu"
      />
    </div>

    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <PriorityIcon :priority="task.priority" />
      <span
        v-if="project"
        class="inline-flex min-w-0 items-center gap-1 font-text text-xs text-gray-500 dark:text-gray-400"
      >
        <span
          :class="['h-2 w-2 shrink-0 rounded-full', PROJECT_COLOR_CLASSES[project.color].dot]"
          aria-hidden="true"
        />
        <span class="truncate">{{ project.name }}</span>
      </span>
      <span
        v-if="dates"
        :class="[
          'inline-flex items-center gap-1 font-text text-xs',
          overdue
            ? 'font-bold text-coral-700 dark:text-coral-500'
            : 'text-gray-500 dark:text-gray-400',
        ]"
      >
        <CalendarClock class="h-3.5 w-3.5" aria-hidden="true" />
        {{ dates }}
        <span v-if="overdue" class="sr-only">{{ t('kanban.overdue') }}</span>
      </span>
    </div>

    <!-- Progreso (v1.1.0): subtareas, casillas, horas y bloqueos -->
    <div
      v-if="
        progress &&
        (progress.subtasks || progress.checklist || progress.hours || progress.blockedBy.length)
      "
      class="flex flex-wrap items-center gap-x-3 gap-y-1 font-text text-xs text-gray-500 dark:text-gray-400"
    >
      <span
        v-if="progress.blockedBy.length"
        class="inline-flex items-center gap-1 font-bold text-coral-700 dark:text-coral-500"
        :title="t('kanban.progress.blockedBy', { keys: progress.blockedBy.join(', ') })"
      >
        <Ban class="h-3.5 w-3.5" aria-hidden="true" />
        {{ t('kanban.progress.blocked') }}
        <span class="sr-only">{{
          t('kanban.progress.blockedBy', { keys: progress.blockedBy.join(', ') })
        }}</span>
      </span>
      <span
        v-if="progress.subtasks"
        class="inline-flex items-center gap-1"
        :title="t('kanban.progress.subtasks', { ...progress.subtasks })"
      >
        <ListChecks class="h-3.5 w-3.5" aria-hidden="true" />
        {{ progress.subtasks.done }}/{{ progress.subtasks.total }}
        <span class="sr-only">{{ t('kanban.progress.subtasks', { ...progress.subtasks }) }}</span>
      </span>
      <span
        v-if="progress.checklist"
        class="inline-flex items-center gap-1"
        :title="t('kanban.progress.checklist', { ...progress.checklist })"
      >
        <SquareCheck class="h-3.5 w-3.5" aria-hidden="true" />
        {{ progress.checklist.done }}/{{ progress.checklist.total }}
        <span class="sr-only">{{ t('kanban.progress.checklist', { ...progress.checklist }) }}</span>
      </span>
      <span
        v-if="progress.hours"
        :class="[
          'inline-flex items-center gap-1',
          overEstimate ? 'font-bold text-coral-700 dark:text-coral-500' : '',
        ]"
        :title="t('kanban.progress.hours')"
      >
        <Clock class="h-3.5 w-3.5" aria-hidden="true" />
        {{ hoursText }}
      </span>
    </div>

    <ul v-if="tags.length" class="m-0 flex list-none flex-wrap gap-1 p-0">
      <li v-for="tag in tags.slice(0, MAX_CARD_TAGS)" :key="tag.id" class="min-w-0">
        <TagChip :tag="tag" small />
      </li>
      <li
        v-if="tags.length > MAX_CARD_TAGS"
        class="font-text text-xs text-gray-500 dark:text-gray-400"
        :title="
          tags
            .slice(MAX_CARD_TAGS)
            .map((tag) => tag.name)
            .join(', ')
        "
      >
        +{{ tags.length - MAX_CARD_TAGS }}
      </li>
    </ul>
  </article>
</template>
