<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Trash2 } from 'lucide-vue-next'
import PriorityIcon from './PriorityIcon.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import type { Task } from '@/domain/task'

/**
 * Lista provisional de tareas (step-10) para poder crear y borrar antes de que existan el
 * calendario (step-11) y la vista de tarea (step-14). Se quitará entonces.
 */
const props = defineProps<{ tasks: Task[] }>()
const emit = defineEmits<{ delete: [task: Task] }>()
const { t } = useI18n()

/** Con fecha primero (por inicio) y luego sin fecha, por clave. */
const sorted = computed(() =>
  [...props.tasks].sort(
    (a, b) =>
      (a.startDate ?? '9999').localeCompare(b.startDate ?? '9999') ||
      a.key.localeCompare(b.key, 'es', { numeric: true }),
  ),
)

function dates(task: Task): string {
  if (!task.startDate) return t('tasks.noDate')
  return task.endDate ? `${task.startDate} → ${task.endDate}` : task.startDate
}
</script>

<template>
  <section class="flex flex-col gap-2">
    <h2 class="m-0 font-text text-sm font-bold text-gray-500 dark:text-gray-400">
      {{ t('tasks.provisionalList') }}
    </h2>
    <p v-if="sorted.length === 0" class="m-0 text-sm text-gray-500 dark:text-gray-400">
      {{ t('tasks.emptyList') }}
    </p>
    <ul v-else class="m-0 flex list-none flex-col gap-1 p-0">
      <li
        v-for="task in sorted"
        :key="task.id"
        class="flex min-w-0 items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <PriorityIcon :priority="task.priority" />
        <span class="w-20 shrink-0 font-text text-sm font-bold text-gray-500 dark:text-gray-400">
          {{ task.key }}
        </span>
        <span class="min-w-0 flex-1 truncate font-text text-sm text-gray-800 dark:text-white">
          {{ task.title }}
        </span>
        <span class="hidden shrink-0 font-text text-sm text-gray-500 md:inline dark:text-gray-400">
          {{ dates(task) }}
        </span>
        <StatusBadge :status="task.status" class="hidden sm:inline-flex" />
        <button
          type="button"
          class="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-gray-500 transition hover:bg-gray-200 hover:text-coral-700 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-coral-500"
          :aria-label="t('tasks.deleteLabel', { key: task.key })"
          :title="t('tasks.deleteLabel', { key: task.key })"
          @click="emit('delete', task)"
        >
          <Trash2 class="h-4 w-4" aria-hidden="true" />
        </button>
      </li>
    </ul>
  </section>
</template>
