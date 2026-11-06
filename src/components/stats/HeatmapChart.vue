<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ChartTooltip from './ChartTooltip.vue'
import { useChartTooltip } from '@/composables/useChartTooltip'
import { fromDayKey } from '@/domain/dates'
import { formatHours } from '@/domain/duration'
import type { HeatCell } from '@/domain/stats'

/**
 * Mapa de calor de horas por día (step-23): semanas en columnas y días de lunes a domingo en
 * filas, en un solo color de más claro a más oscuro (cuartos del día con más horas). Los días
 * sin horas, en gris.
 */
const props = defineProps<{ weeks: (HeatCell | null)[][] }>()

const { t, locale } = useI18n()
const box = ref<HTMLElement | null>(null)
const { tip, on } = useChartTooltip(box)

const LEVELS = [
  'bg-gray-100 dark:bg-gray-800',
  'bg-blue-500/35',
  'bg-blue-500/60',
  'bg-blue-500/80',
  'bg-blue-500',
]
const fmt = computed(
  () => new Intl.DateTimeFormat(locale.value, { weekday: 'short', day: 'numeric', month: 'short' }),
)
const dayNames = computed(() =>
  // 2026-11-02 es lunes
  Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale.value, { weekday: 'narrow' }).format(new Date(2026, 10, 2 + i)),
  ),
)
const label = (cell: HeatCell) => fmt.value.format(fromDayKey(cell.date))
const big = computed(() => props.weeks.length <= 6)
</script>

<template>
  <div ref="box" class="relative flex flex-col gap-2">
    <div class="flex gap-1 overflow-x-auto pb-1">
      <div class="flex shrink-0 flex-col gap-1" aria-hidden="true">
        <span
          v-for="(d, i) in dayNames"
          :key="i"
          :class="[
            'flex items-center font-text text-xs text-gray-500 dark:text-gray-400',
            big ? 'h-7' : 'h-3.5',
          ]"
          >{{ i % 2 === 0 ? d : '' }}</span
        >
      </div>
      <div v-for="(week, w) in weeks" :key="w" class="flex shrink-0 flex-col gap-1">
        <template v-for="(cell, d) in week" :key="d">
          <span
            v-if="cell"
            :class="[
              'block rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600',
              big ? 'h-7 w-7' : 'h-3.5 w-3.5',
              LEVELS[cell.level],
            ]"
            tabindex="0"
            :aria-label="`${label(cell)}: ${formatHours(cell.minutes)}`"
            v-bind="on(formatHours(cell.minutes), label(cell))"
          />
          <span v-else :class="['block', big ? 'h-7 w-7' : 'h-3.5 w-3.5']" aria-hidden="true" />
        </template>
      </div>
    </div>
    <div
      class="flex items-center gap-1.5 font-text text-xs text-gray-500 dark:text-gray-400"
      aria-hidden="true"
    >
      {{ t('stats.heatLess') }}
      <span v-for="(cls, i) in LEVELS" :key="i" :class="['h-3 w-3 rounded-sm', cls]" />
      {{ t('stats.heatMore') }}
    </div>
    <ChartTooltip :tip="tip" />
  </div>
</template>
