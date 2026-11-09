<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { CalendarClock } from 'lucide-vue-next'
import PriorityIcon from '@/components/tasks/PriorityIcon.vue'
import StatusSelect from '@/components/task/StatusSelect.vue'
import { fromDayKey, type DayKey } from '@/domain/dates'
import { isOverdue } from '@/domain/kanban'
import { PROJECT_COLOR_CLASSES } from '@/domain/projects'
import type { TaskStatus } from '@/domain/status'
import type { Task } from '@/domain/task'
import { useProjectsStore } from '@/stores/projects'

/**
 * Fila de una tarea en las listas (panel «Para hoy» y backlog, v1.1.0): prioridad, clave y título
 * que llevan a la tarea, proyecto, fechas (en coral si está atrasada) y el estado, que se cambia
 * desde la propia fila. El slot `actions` añade botones al final.
 */
const props = defineProps<{ task: Task; today: DayKey; busy?: boolean }>()
const emit = defineEmits<{ changeStatus: [status: TaskStatus] }>()

const { t, locale } = useI18n()
const projectsStore = useProjectsStore()
const project = computed(() =>
  props.task.projectId ? projectsStore.byId(props.task.projectId) : undefined,
)
const overdue = computed(() => isOverdue(props.task, props.today))
const shortDate = computed(
  () => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short' }),
)
const dates = computed(() => {
  const { startDate, endDate } = props.task
  const fmt = (d: DayKey) => shortDate.value.format(fromDayKey(d))
  if (!startDate && !endDate) return ''
  if (startDate && endDate && endDate !== startDate) return `${fmt(startDate)} → ${fmt(endDate)}`
  return fmt((endDate ?? startDate)!)
})
</script>

<template>
  <li
    class="relative flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 focus-within:z-40 hover:bg-gray-100 dark:hover:bg-gray-800"
  >
    <slot name="before" />
    <PriorityIcon :priority="task.priority" class="shrink-0" />
    <RouterLink
      :to="{ name: 'task', params: { taskKey: task.key } }"
      class="flex min-w-0 flex-1 items-center gap-2 font-text text-sm no-underline"
    >
      <span class="shrink-0 font-bold text-blue-600 dark:text-blue-400">{{ task.key }}</span>
      <span class="min-w-0 truncate text-gray-800 dark:text-white">{{ task.title }}</span>
    </RouterLink>
    <span
      v-if="project"
      class="hidden min-w-0 shrink-0 items-center gap-1 font-text text-xs text-gray-500 md:inline-flex dark:text-gray-400"
    >
      <span
        :class="['h-2 w-2 shrink-0 rounded-full', PROJECT_COLOR_CLASSES[project.color].dot]"
        aria-hidden="true"
      />
      <span class="max-w-28 truncate">{{ project.name }}</span>
    </span>
    <span
      v-if="dates"
      :class="[
        'hidden shrink-0 items-center gap-1 font-text text-xs sm:inline-flex',
        overdue
          ? 'font-bold text-coral-700 dark:text-coral-500'
          : 'text-gray-500 dark:text-gray-400',
      ]"
    >
      <CalendarClock class="h-3.5 w-3.5" aria-hidden="true" />
      {{ dates }}
      <span v-if="overdue" class="sr-only">{{ t('kanban.overdue') }}</span>
    </span>
    <StatusSelect
      compact
      :status="task.status"
      :disabled="busy"
      class="shrink-0"
      @change="emit('changeStatus', $event)"
    />
    <slot name="actions" />
  </li>
</template>
