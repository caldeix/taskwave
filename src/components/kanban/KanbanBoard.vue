<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import KanbanColumn from './KanbanColumn.vue'
import type { DayKey } from '@/domain/dates'
import { groupByStatus, type ClosedWindow } from '@/domain/kanban'
import { cardProgress, progressIndex } from '@/domain/progress'
import type { Project } from '@/domain/projects'
import { TASK_STATUSES, isClosedStatus, type TaskStatus } from '@/domain/status'
import type { Task } from '@/domain/task'

/**
 * Kanban (step-12): una columna por estado, con orden automático (D-35) y las cerradas
 * limitadas a un periodo con «Ver más antiguas» (D-36). En pantallas estrechas se desplaza en
 * horizontal (D-49).
 */
const props = defineProps<{
  tasks: Task[]
  today: DayKey
  projectOf: (task: Task) => Project | undefined
  closedWindow: ClosedWindow
  /** Orden de las columnas (filtro de orden, step-13). */
  sorter: (tasks: Task[]) => Task[]
  /** Estados ocultos con el ojo (step-13). */
  hiddenStatuses: TaskStatus[]
  /** Todas las tareas leídas (sin filtrar), para el progreso de las tarjetas (v1.1.0). */
  allTasks?: Task[]
}>()
const emit = defineEmits<{
  move: [task: Task, status: TaskStatus]
  open: [task: Task]
  duplicate: [task: Task]
  delete: [task: Task]
  moreClosed: []
}>()

const { t } = useI18n()
const columns = computed(() => groupByStatus(props.tasks, props.sorter))
const index = computed(() => progressIndex(props.allTasks ?? props.tasks))
const progressOf = (task: Task) => cardProgress(task, index.value)
const visibleStatuses = computed(() =>
  TASK_STATUSES.filter((s) => !props.hiddenStatuses.includes(s)),
)
</script>

<template>
  <div class="relative -mx-4 overflow-x-auto px-4 pb-2 md:-mx-8 md:px-8">
    <div class="flex min-w-max items-start gap-4">
      <KanbanColumn
        v-for="status in visibleStatuses"
        :key="status"
        :status="status"
        :tasks="columns[status]"
        :today="today"
        :project-of="projectOf"
        :progress-of="progressOf"
        @drop="emit('move', $event, status)"
        @move="(task, next) => emit('move', task, next)"
        @open="emit('open', $event)"
        @duplicate="emit('duplicate', $event)"
        @delete="emit('delete', $event)"
      >
        <template v-if="isClosedStatus(status)" #footer>
          <p class="m-0 px-1 font-text text-xs text-gray-500 dark:text-gray-400">
            {{
              closedWindow === null
                ? t('kanban.closedAll')
                : t('kanban.closedWindow', { days: closedWindow })
            }}
          </p>
          <button
            v-if="closedWindow !== null"
            type="button"
            class="cursor-pointer self-start rounded-lg border-0 bg-transparent px-1 font-text text-xs font-bold text-blue-600 transition hover:text-blue-500 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-blue-400"
            @click="emit('moreClosed')"
          >
            {{ t('kanban.showOlder') }}
          </button>
        </template>
      </KanbanColumn>
    </div>
  </div>
</template>
