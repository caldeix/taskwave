<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ChevronsDown, ChevronsUp, Equal } from 'lucide-vue-next'
import type { Priority } from '@/domain/task'

/** Prioridad con icono y color del DS: alta coral, media mostaza, baja azul (D-51). */
defineProps<{ priority: Priority }>()
const { t } = useI18n()

const ICONS = { high: ChevronsUp, medium: Equal, low: ChevronsDown } as const
const COLORS = {
  high: 'text-coral-700 dark:text-coral-500',
  medium: 'text-mustard-700 dark:text-mustard-500',
  low: 'text-blue-600 dark:text-blue-400',
} as const
</script>

<template>
  <span
    class="inline-flex shrink-0"
    :title="t(`tasks.priority.${priority}`)"
    role="img"
    :aria-label="t(`tasks.priority.${priority}`)"
  >
    <component :is="ICONS[priority]" :class="['h-4 w-4', COLORS[priority]]" aria-hidden="true" />
  </span>
</template>
