<script setup lang="ts">
import { computed, ref } from 'vue'
import ChartTooltip from './ChartTooltip.vue'
import { useChartTooltip } from '@/composables/useChartTooltip'
import { formatHours } from '@/domain/duration'

/**
 * Columnas de horas (step-23): un solo color (magnitud), columnas de 24 px como mucho con el
 * extremo redondeado, separación de 2 px, rejilla fina y ejes en horas redondas. Cada columna
 * enseña su valor al pasar el ratón o con el teclado.
 */
export interface Column {
  key: string
  /** Texto bajo la columna (corto). */
  label: string
  /** Texto del aviso y de la accesibilidad (largo). */
  long: string
  minutes: number
}

const props = defineProps<{ columns: Column[]; labelEvery?: number }>()

const box = ref<HTMLElement | null>(null)
const { tip, on } = useChartTooltip(box)

/** Escala en horas redondas: 3 o 4 marcas. */
const ticks = computed(() => {
  const maxH = Math.max(1, ...props.columns.map((c) => c.minutes / 60))
  const step = [1, 2, 4, 5, 10, 20, 25, 50, 100].find((s) => maxH / s <= 4) ?? 200
  const top = Math.ceil(maxH / step) * step
  return Array.from({ length: top / step + 1 }, (_, i) => i * step)
})
const topMin = computed(() => ticks.value[ticks.value.length - 1]! * 60)
const every = computed(() => props.labelEvery ?? Math.max(1, Math.ceil(props.columns.length / 12)))
</script>

<template>
  <div ref="box" class="relative flex flex-col gap-1">
    <div class="flex gap-2">
      <!-- Eje de horas -->
      <div
        class="relative h-44 w-8 shrink-0 font-text text-xs text-gray-500 tabular-nums dark:text-gray-400"
        aria-hidden="true"
      >
        <span
          v-for="h in ticks"
          :key="h"
          class="absolute right-0"
          :style="{ bottom: `${(h * 60 * 100) / topMin}%`, transform: 'translateY(50%)' }"
          >{{ h }}h</span
        >
      </div>
      <!-- Rejilla y columnas -->
      <div class="relative h-44 min-w-0 flex-1">
        <div
          v-for="h in ticks"
          :key="h"
          class="absolute inset-x-0 h-px bg-gray-200 dark:bg-gray-700"
          :style="{ bottom: `${(h * 60 * 100) / topMin}%` }"
          aria-hidden="true"
        />
        <ul class="absolute inset-0 m-0 flex list-none items-end gap-0.5 p-0">
          <li
            v-for="col in columns"
            :key="col.key"
            class="flex h-full min-w-0 flex-1 items-end justify-center outline-none focus-visible:bg-gray-100 dark:focus-visible:bg-gray-800"
            tabindex="0"
            :aria-label="`${col.long}: ${formatHours(col.minutes)}`"
            v-bind="on(formatHours(col.minutes), col.long)"
          >
            <span
              v-if="col.minutes > 0"
              class="block w-full max-w-6 rounded-t bg-blue-500 transition hover:bg-blue-600"
              :style="{ height: `max(2px, ${(col.minutes * 100) / topMin}%)` }"
            />
          </li>
        </ul>
      </div>
    </div>
    <!-- Etiquetas -->
    <div class="flex gap-2" aria-hidden="true">
      <span class="w-8 shrink-0" />
      <div class="flex min-w-0 flex-1 gap-0.5">
        <span
          v-for="(col, i) in columns"
          :key="col.key"
          class="min-w-0 flex-1 text-center font-text text-xs whitespace-nowrap text-gray-500 dark:text-gray-400"
          >{{ i % every === 0 ? col.label : '' }}</span
        >
      </div>
    </div>
    <ChartTooltip :tip="tip" />
  </div>
</template>
