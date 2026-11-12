<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import ChartTooltip from './ChartTooltip.vue'
import { useChartTooltip } from '@/composables/useChartTooltip'
import { formatHours } from '@/domain/duration'
import { ON_TARGET_PCT, type AccuracyRow } from '@/domain/stats'

/**
 * Desviación de cada tarea respecto a su estimado (step-23, D-31): barra divergente desde el
 * centro, en verde si sobró tiempo y en coral si se pasó (hasta ±100 %; más allá, la barra llega
 * al borde y el número lo dice). Las que quedan dentro del margen (±10 %) van en gris y dicen «en
 * lo estimado», igual que cuentan en las fichas (v1.3.4). El texto nunca va en el color de la barra.
 */
const props = defineProps<{ rows: AccuracyRow[]; max?: number }>()

const { t } = useI18n()
const box = ref<HTMLElement | null>(null)
const { tip, on } = useChartTooltip(box)
const showAll = ref(false)
const limit = computed(() => props.max ?? 10)
const shown = computed(() => (showAll.value ? props.rows : props.rows.slice(0, limit.value)))

const width = (pct: number) => `${Math.min(100, Math.abs(pct)) / 2}%`
/** «100 % más» o «82 % menos», sin signos: el color de la barra ya dice cuál es. */
const signed = (pct: number) =>
  pct > 0
    ? t('stats.accuracy.pctMore', { pct })
    : pct < 0
      ? t('stats.accuracy.pctLess', { pct: -pct })
      : t('stats.accuracy.exact')
const inMargin = (pct: number) => Math.abs(pct) <= ON_TARGET_PCT
const label = (pct: number) =>
  inMargin(pct) && pct !== 0 ? `${signed(pct)} · ${t('stats.accuracy.inMargin')}` : signed(pct)
const barClass = (pct: number) =>
  inMargin(pct)
    ? 'bg-gray-400 dark:bg-gray-500'
    : pct > 0
      ? 'bg-coral-500 dark:bg-coral-700'
      : 'bg-emerald-500'
const detail = (r: AccuracyRow) =>
  t('stats.accuracy.detail', {
    spent: formatHours(r.spentMin),
    estimate: formatHours(r.estimateMin),
  })
</script>

<template>
  <div ref="box" class="relative flex flex-col gap-2">
    <ul class="m-0 flex list-none flex-col gap-2 p-0">
      <li
        v-for="row in shown"
        :key="row.task.id"
        class="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_5.5rem] sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_6.5rem] items-center gap-3"
      >
        <RouterLink
          :to="{ name: 'task', params: { taskKey: row.task.key } }"
          class="min-w-0 truncate font-text text-sm text-gray-800 no-underline hover:underline dark:text-white"
          :title="row.task.title"
        >
          <span class="font-bold text-gray-500 dark:text-gray-400">{{ row.task.key }}</span>
          {{ row.task.title }}
        </RouterLink>
        <span
          class="relative h-3 rounded outline-none focus-visible:outline-2 focus-visible:outline-blue-600"
          tabindex="0"
          :aria-label="`${row.task.key}: ${label(row.deviationPct)}, ${detail(row)}`"
          v-bind="on(label(row.deviationPct), detail(row))"
        >
          <span class="absolute inset-y-0 left-1/2 w-px bg-gray-300 dark:bg-gray-600" />
          <span
            v-if="row.deviationPct > 0"
            :class="['absolute inset-y-0 left-1/2 rounded-r', barClass(row.deviationPct)]"
            :style="{ width: width(row.deviationPct) }"
          />
          <span
            v-else-if="row.deviationPct < 0"
            :class="['absolute inset-y-0 right-1/2 rounded-l', barClass(row.deviationPct)]"
            :style="{ width: width(row.deviationPct) }"
          />
        </span>
        <span
          class="flex flex-col text-right font-text text-sm text-gray-800 tabular-nums dark:text-white"
        >
          {{ signed(row.deviationPct) }}
          <span
            v-if="inMargin(row.deviationPct)"
            class="text-xs text-gray-500 dark:text-gray-400"
            >{{ t('stats.accuracy.inMargin') }}</span
          >
        </span>
      </li>
    </ul>
    <div
      class="flex flex-wrap items-center gap-4 font-text text-xs text-gray-500 dark:text-gray-400"
    >
      <span class="inline-flex items-center gap-1.5">
        <span class="h-3 w-3 rounded-sm bg-emerald-500" aria-hidden="true" />
        {{ t('stats.accuracy.under') }}
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="h-3 w-3 rounded-sm bg-coral-500 dark:bg-coral-700" aria-hidden="true" />
        {{ t('stats.accuracy.over') }}
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="h-3 w-3 rounded-sm bg-gray-400 dark:bg-gray-500" aria-hidden="true" />
        {{ t('stats.accuracy.inMarginLegend') }}
      </span>
      <button
        v-if="rows.length > limit"
        type="button"
        class="ml-auto cursor-pointer border-0 bg-transparent p-0 font-text text-xs font-bold text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-blue-400"
        @click="showAll = !showAll"
      >
        {{ showAll ? t('stats.accuracy.fewer') : t('stats.accuracy.all', { n: rows.length }) }}
      </button>
    </div>
    <ChartTooltip :tip="tip" />
  </div>
</template>
