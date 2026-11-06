<script setup lang="ts">
import type { Tip } from '@/composables/useChartTooltip'

/** Aviso flotante de un gráfico: el valor primero, en negrita, y debajo a qué corresponde. */
defineProps<{ tip: Tip | null }>()
</script>

<template>
  <div
    v-if="tip"
    class="pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-[calc(100%+8px)] flex-col rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 font-text shadow-lg dark:border-gray-700 dark:bg-gray-900"
    :style="{ left: `${tip.x}px`, top: `${tip.y}px` }"
    aria-hidden="true"
  >
    <span class="text-sm font-bold whitespace-nowrap text-gray-800 dark:text-white">{{
      tip.value
    }}</span>
    <span class="text-xs whitespace-nowrap text-gray-500 dark:text-gray-400">{{ tip.label }}</span>
  </div>
</template>
