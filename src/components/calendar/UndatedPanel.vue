<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { CalendarOff, GripVertical } from 'lucide-vue-next'
import PriorityIcon from '@/components/tasks/PriorityIcon.vue'
import { STATUS_STYLES } from '@/domain/status'
import type { Task } from '@/domain/task'
import { useTaskDrag } from '@/composables/useTaskDrag'

/**
 * Panel «Sin fecha» (D-19): tareas sin fecha de inicio, que se arrastran a un día del
 * calendario para dársela.
 */
const props = defineProps<{ tasks: Task[] }>()
const emit = defineEmits<{ openTask: [task: Task] }>()
const { t } = useI18n()
const { start, end } = useTaskDrag()

const sorted = computed(() =>
  [...props.tasks].sort((a, b) => a.key.localeCompare(b.key, 'es', { numeric: true })),
)
</script>

<template>
  <aside
    class="flex min-w-0 flex-col gap-3 rounded-lg bg-gray-100 p-4 dark:bg-gray-800"
    :aria-label="t('calendar.undated')"
  >
    <header class="flex items-center gap-2">
      <CalendarOff class="h-4 w-4 text-gray-500 dark:text-gray-400" aria-hidden="true" />
      <h2 class="m-0 font-text text-sm font-bold text-gray-800 dark:text-white">
        {{ t('calendar.undated') }}
      </h2>
      <span class="ml-auto font-text text-xs font-bold text-gray-500 dark:text-gray-400">
        {{ tasks.length }}
      </span>
    </header>
    <p class="m-0 font-text text-xs leading-normal text-gray-500 dark:text-gray-400">
      {{ tasks.length ? t('calendar.undatedHint') : t('calendar.undatedEmpty') }}
    </p>
    <ul class="m-0 flex list-none flex-col gap-1.5 p-0">
      <li v-for="task in sorted" :key="task.id">
        <button
          type="button"
          draggable="true"
          :title="`${task.key} ${task.title}`"
          class="flex w-full min-w-0 cursor-grab items-center gap-2 rounded-lg border-0 bg-white px-2 py-2 text-left shadow-sm transition hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-blue-600 active:cursor-grabbing dark:bg-gray-900 dark:hover:bg-gray-700"
          @dragstart="start($event, task, null)"
          @dragend="end"
          @click="emit('openTask', task)"
        >
          <GripVertical class="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
          <span
            :class="['h-2.5 w-2.5 shrink-0 rounded-full', STATUS_STYLES[task.status].dot]"
            aria-hidden="true"
          />
          <span class="shrink-0 font-text text-xs font-bold text-gray-500 dark:text-gray-400">{{
            task.key
          }}</span>
          <span class="min-w-0 flex-1 truncate font-text text-sm text-gray-800 dark:text-white">{{
            task.title
          }}</span>
          <PriorityIcon :priority="task.priority" />
        </button>
      </li>
    </ul>
  </aside>
</template>
