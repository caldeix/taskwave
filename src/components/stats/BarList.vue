<script setup lang="ts">
import { computed, ref } from 'vue'
import ChartTooltip from './ChartTooltip.vue'
import { useChartTooltip } from '@/composables/useChartTooltip'
import { formatHours } from '@/domain/duration'

/**
 * Barras horizontales ordenadas de más a menos (step-23): horas por proyecto o por tag. Un solo
 * color (se comparan magnitudes, no identidades); el punto de color del proyecto o tag va junto
 * al nombre. El valor va al final de cada barra y el % del total en el aviso.
 */
export interface BarItem {
  key: string
  label: string
  /** Clase del punto de color (proyecto o tag), opcional. */
  dot?: string
  minutes: number
}

const props = defineProps<{ items: BarItem[]; total: number }>()

const box = ref<HTMLElement | null>(null)
const { tip, on } = useChartTooltip(box)
const max = computed(() => Math.max(1, ...props.items.map((i) => i.minutes)))
const pct = (m: number) => (props.total ? Math.round((m * 100) / props.total) : 0)
</script>

<template>
  <div ref="box" class="relative">
    <ul class="m-0 flex list-none flex-col gap-2 p-0">
      <li
        v-for="item in items"
        :key="item.key"
        class="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-3 rounded outline-none focus-visible:bg-gray-100 dark:focus-visible:bg-gray-800"
        tabindex="0"
        :aria-label="`${item.label}: ${formatHours(item.minutes)} (${pct(item.minutes)} %)`"
        v-bind="on(`${formatHours(item.minutes)} · ${pct(item.minutes)} %`, item.label)"
      >
        <span
          class="flex min-w-0 items-center gap-1.5 font-text text-sm text-gray-800 dark:text-white"
        >
          <span
            v-if="item.dot"
            :class="['h-2 w-2 shrink-0 rounded-full', item.dot]"
            aria-hidden="true"
          />
          <span class="truncate" :title="item.label">{{ item.label }}</span>
        </span>
        <span class="flex min-w-0 items-center gap-2">
          <span
            class="block h-3 rounded-r bg-blue-500 transition hover:bg-blue-600"
            :style="{ width: `max(2px, ${(item.minutes * 85) / max}%)` }"
          />
          <span class="shrink-0 font-text text-xs text-gray-500 tabular-nums dark:text-gray-400">{{
            formatHours(item.minutes)
          }}</span>
        </span>
      </li>
    </ul>
    <ChartTooltip :tip="tip" />
  </div>
</template>
