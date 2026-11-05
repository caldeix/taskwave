<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import KanbanCard from './KanbanCard.vue'
import type { DayKey } from '@/domain/dates'
import type { Project } from '@/domain/projects'
import { STATUS_STYLES, type TaskStatus } from '@/domain/status'
import type { Task } from '@/domain/task'
import { useTaskDrag } from '@/composables/useTaskDrag'

/** Columna de un estado: recibe tarjetas arrastradas desde otras columnas. */
const props = defineProps<{
  status: TaskStatus
  tasks: Task[]
  today: DayKey
  projectOf: (task: Task) => Project | undefined
}>()
const emit = defineEmits<{
  drop: [task: Task]
  open: [task: Task]
  move: [task: Task, status: TaskStatus]
  delete: [task: Task]
}>()

const { t } = useI18n()
const { dragged, end } = useTaskDrag()
const over = ref(false)

function onDragOver(event: DragEvent): void {
  if (!dragged.value || dragged.value.task.status === props.status) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  over.value = true
}

function onDrop(event: DragEvent): void {
  event.preventDefault()
  over.value = false
  const state = dragged.value
  end()
  if (state && state.task.status !== props.status) emit('drop', state.task)
}
</script>

<template>
  <section
    :class="[
      'flex w-72 shrink-0 flex-col gap-3 rounded-lg bg-gray-100 p-3 transition dark:bg-gray-800',
      over ? 'outline-2 outline-offset-[-2px] outline-blue-500' : '',
    ]"
    :aria-label="t(`status.${status}`)"
    @dragover="onDragOver"
    @dragleave="over = false"
    @drop="onDrop"
  >
    <header class="flex items-center gap-2 px-1">
      <span
        :class="['h-3 w-3 shrink-0 rounded-full', STATUS_STYLES[status].dot]"
        aria-hidden="true"
      />
      <h2 class="m-0 font-text text-sm font-bold text-gray-800 dark:text-white">
        {{ t(`status.${status}`) }}
      </h2>
      <span class="ml-auto font-text text-xs font-bold text-gray-500 dark:text-gray-400">{{
        tasks.length
      }}</span>
    </header>

    <p
      v-if="tasks.length === 0"
      class="m-0 px-1 font-text text-xs text-gray-500 dark:text-gray-400"
    >
      {{ t('kanban.empty') }}
    </p>
    <ul class="m-0 flex list-none flex-col gap-2 p-0">
      <li v-for="task in tasks" :key="task.id">
        <KanbanCard
          :task="task"
          :today="today"
          :project="projectOf(task)"
          @open="emit('open', task)"
          @move="emit('move', task, $event)"
          @delete="emit('delete', task)"
        />
      </li>
    </ul>
    <slot name="footer" />
  </section>
</template>
