<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { X } from 'lucide-vue-next'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { formatHours } from '@/domain/duration'
import type { Task } from '@/domain/task'

/**
 * Una tarea relacionada (vinculada, padre o subtarea): clave y título que llevan a la tarea,
 * estado y, si se pide, horas. Si ya no existe, lo dice y deja quitar el vínculo.
 */
const props = defineProps<{
  task: Task | null
  loading?: boolean
  removeLabel: string
  showHours?: boolean
}>()
const emit = defineEmits<{ remove: [] }>()
const { t } = useI18n()

const hours = computed(() => {
  if (!props.task) return ''
  const spent = formatHours(props.task.spentMin)
  return props.task.estimateMin !== null
    ? `${spent} / ${formatHours(props.task.estimateMin)}`
    : spent
})
</script>

<template>
  <li
    class="group flex min-w-0 items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800"
  >
    <template v-if="task">
      <RouterLink
        :to="{ name: 'task', params: { taskKey: task.key } }"
        class="flex min-w-0 flex-1 items-center gap-2 font-text text-sm no-underline"
      >
        <span class="shrink-0 font-bold text-blue-600 dark:text-blue-400">{{ task.key }}</span>
        <span
          :class="[
            'min-w-0 truncate text-gray-800 dark:text-white',
            task.status === 'done' || task.status === 'discarded' ? 'line-through opacity-70' : '',
          ]"
          >{{ task.title }}</span
        >
      </RouterLink>
      <span
        v-if="showHours"
        class="hidden shrink-0 font-text text-xs text-gray-500 sm:inline dark:text-gray-400"
        >{{ hours }}</span
      >
      <StatusBadge :status="task.status" class="shrink-0" />
    </template>
    <span v-else class="flex-1 font-text text-sm text-gray-500 italic dark:text-gray-400">
      {{ loading ? t('relations.loading') : t('relations.missing') }}
    </span>
    <button
      type="button"
      class="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-gray-500 transition hover:bg-gray-200 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
      :aria-label="removeLabel"
      :title="removeLabel"
      @click="emit('remove')"
    >
      <X class="h-4 w-4" aria-hidden="true" />
    </button>
  </li>
</template>
