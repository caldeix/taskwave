<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChartColumn, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import AccuracyList from '@/components/stats/AccuracyList.vue'
import BarList, { type BarItem } from '@/components/stats/BarList.vue'
import ChartCard from '@/components/stats/ChartCard.vue'
import ColumnChart, { type Column } from '@/components/stats/ColumnChart.vue'
import HeatmapChart from '@/components/stats/HeatmapChart.vue'
import StatTile from '@/components/stats/StatTile.vue'
import { loadStats, type StatsData } from '@/data/stats'
import { fromDayKey, todayKey } from '@/domain/dates'
import { formatHours } from '@/domain/duration'
import { PROJECT_COLOR_CLASSES } from '@/domain/projects'
import {
  STATS_PERIODS,
  estimateAccuracy,
  koSummary,
  heatmap,
  minutesByDay,
  minutesByProject,
  minutesByTag,
  minutesByWeek,
  rangeLength,
  shiftAnchor,
  statsRange,
  summarize,
  type Share,
  type StatsPeriod,
} from '@/domain/stats'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/stores/auth'
import { useProjectsStore } from '@/stores/projects'
import { useTagsStore } from '@/stores/tags'

/**
 * Panel de estadísticas (step-23, D-55, CA-17): horas por día, semana, proyecto y tag del
 * periodo elegido, mapa de calor y acierto de las estimaciones. Los datos se leen una vez por
 * periodo; mientras se cargan otros, se mantiene lo anterior atenuado.
 */
const { t, locale } = useI18n()
const authStore = useAuthStore()
const projectsStore = useProjectsStore()
const tagsStore = useTagsStore()

// ---------------------------------------------------------------- periodo
const period = ref<StatsPeriod>('month')
const anchor = ref(todayKey())
const range = computed(() => statsRange(period.value, anchor.value))
const isCurrent = computed(() => {
  const today = todayKey()
  return range.value.from <= today && today <= range.value.to
})

const rangeLabel = computed(() => {
  const from = fromDayKey(range.value.from)
  const to = fromDayKey(range.value.to)
  if (period.value === 'year') return String(from.getFullYear())
  if (period.value === 'month')
    return new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric' }).format(from)
  const f = new Intl.DateTimeFormat(locale.value, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return `${f.format(from)} – ${f.format(to)}`
})

function move(step: -1 | 1): void {
  anchor.value = shiftAnchor(period.value, anchor.value, step)
}

// ---------------------------------------------------------------- datos
const data = ref<StatsData | null>(null)
const loading = ref(false)
const failed = ref(false)
let request = 0

watch(
  () => [authStore.user?.uid ?? null, range.value.from, range.value.to] as const,
  async ([uid]) => {
    if (!uid) return
    const id = ++request
    loading.value = true
    failed.value = false
    try {
      const result = await loadStats(db, uid, range.value)
      if (id === request) data.value = result
    } catch {
      if (id === request) failed.value = true
    } finally {
      if (id === request) loading.value = false
    }
  },
  { immediate: true },
)

const logs = computed(() => data.value?.logs ?? [])
const summary = computed(() => summarize(logs.value))
const days = computed(() => minutesByDay(logs.value, range.value))
const length = computed(() => rangeLength(range.value))

const dayFmt = computed(() => new Intl.DateTimeFormat(locale.value, { day: 'numeric' }))
const longFmt = computed(
  () => new Intl.DateTimeFormat(locale.value, { weekday: 'long', day: 'numeric', month: 'short' }),
)
const weekFmt = computed(
  () => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short' }),
)

const dayColumns = computed<Column[]>(() =>
  days.value.map((d) => ({
    key: d.key,
    label:
      period.value === 'week'
        ? longFmt.value.format(fromDayKey(d.key)).slice(0, 3)
        : dayFmt.value.format(fromDayKey(d.key)),
    long: longFmt.value.format(fromDayKey(d.key)),
    minutes: d.minutes,
  })),
)
const weekColumns = computed<Column[]>(() =>
  minutesByWeek(logs.value, range.value).map((w) => ({
    key: w.key,
    label: weekFmt.value.format(fromDayKey(w.key)),
    long: t('stats.weekOf', { date: weekFmt.value.format(fromDayKey(w.key)) }),
    minutes: w.minutes,
  })),
)

function projectItems(shares: Share[]): BarItem[] {
  return shares.map((s) => {
    const project = s.id ? projectsStore.byId(s.id) : undefined
    return {
      key: s.id ?? 'none',
      label: s.id ? (project?.name ?? t('stats.deletedProject')) : t('nav.inbox'),
      dot: project ? PROJECT_COLOR_CLASSES[project.color].dot : 'bg-gray-500',
      minutes: s.minutes,
    }
  })
}
function tagItems(shares: Share[]): BarItem[] {
  return shares.map((s) => {
    const tag = s.id ? tagsStore.byId(s.id) : undefined
    return {
      key: s.id ?? 'none',
      label: s.id ? (tag?.name ?? t('stats.deletedTag')) : t('stats.noTag'),
      dot: tag ? PROJECT_COLOR_CLASSES[tag.color]?.dot : 'bg-gray-500',
      minutes: s.minutes,
    }
  })
}
const byProject = computed(() => projectItems(minutesByProject(logs.value)))
const byTag = computed(() => tagItems(minutesByTag(logs.value, data.value?.tasks ?? new Map())))
const heat = computed(() => heatmap(days.value))
const accuracy = computed(() => estimateAccuracy(data.value?.closed ?? []))
const ko = computed(() => koSummary(data.value?.closed ?? []))
/** Total del periodo dicho con palabras: «59 % menos» o «12 % más», sin signos. */
const totalValue = computed(() => {
  const pct = accuracy.value.totalPct ?? 0
  if (pct === 0) return t('stats.accuracy.exact')
  return t(pct > 0 ? 'stats.accuracy.pctMore' : 'stats.accuracy.pctLess', { pct: Math.abs(pct) })
})
const totalClass = computed(() => {
  const pct = accuracy.value.totalPct ?? 0
  if (pct > 0) return 'text-coral-700 dark:text-coral-500'
  if (pct < 0) return 'text-emerald-700 dark:text-emerald-500'
  return ''
})
const totalHint = computed(() => {
  const { spentMin, estimatedMin } = accuracy.value
  const diff = spentMin - estimatedMin
  const base = { spent: formatHours(spentMin), estimate: formatHours(estimatedMin) }
  if (diff > 0) return t('stats.accuracy.totalOver', { ...base, hours: formatHours(diff) })
  if (diff < 0) return t('stats.accuracy.totalUnder', { ...base, hours: formatHours(-diff) })
  return t('stats.accuracy.totalExact', base)
})

const segment =
  'h-9 cursor-pointer border-0 px-3 font-text text-sm transition focus-visible:outline-2 focus-visible:outline-blue-600'
const iconButton =
  'inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-gray-800 transition hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-white dark:hover:bg-gray-700'
</script>

<template>
  <main class="flex min-w-0 flex-1 flex-col gap-6 px-4 py-6 md:px-8">
    <header class="flex min-w-0 items-center gap-3">
      <span
        class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800"
      >
        <ChartColumn class="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
      </span>
      <div class="flex min-w-0 flex-col">
        <h1
          class="m-0 w-fit bg-radial-blue bg-clip-text font-title text-4xl leading-tight font-semibold text-transparent"
        >
          {{ t('stats.title') }}
        </h1>
        <p class="m-0 text-sm text-gray-500 dark:text-gray-400">{{ t('stats.subtitle') }}</p>
      </div>
    </header>

    <!-- Periodo: una fila encima de todo, afecta a todos los gráficos -->
    <div class="flex flex-wrap items-center gap-2">
      <div
        class="inline-flex overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800"
        role="group"
        :aria-label="t('stats.period')"
      >
        <button
          v-for="p in STATS_PERIODS"
          :key="p"
          type="button"
          :class="[
            segment,
            period === p
              ? 'bg-blue-500 font-bold text-white'
              : 'bg-transparent text-gray-800 hover:bg-gray-200 dark:text-white dark:hover:bg-gray-700',
          ]"
          :aria-pressed="period === p"
          @click="period = p"
        >
          {{ t(`stats.periods.${p}`) }}
        </button>
      </div>
      <div class="flex items-center gap-1">
        <button
          type="button"
          :class="iconButton"
          :aria-label="t('stats.previous')"
          @click="move(-1)"
        >
          <ChevronLeft class="h-4 w-4" aria-hidden="true" />
        </button>
        <span
          class="min-w-36 text-center font-text text-sm font-bold text-gray-800 first-letter:uppercase dark:text-white"
          aria-live="polite"
          >{{ rangeLabel }}</span
        >
        <button
          type="button"
          :class="iconButton"
          :aria-label="t('stats.next')"
          :disabled="isCurrent"
          @click="move(1)"
        >
          <ChevronRight class="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          v-if="!isCurrent"
          type="button"
          class="h-9 cursor-pointer rounded-lg border-0 bg-transparent px-3 font-text text-sm font-bold text-blue-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-blue-400 dark:hover:bg-gray-800"
          @click="anchor = todayKey()"
        >
          {{ t('stats.today') }}
        </button>
      </div>
    </div>

    <p v-if="failed" class="m-0 font-text text-sm text-coral-700 dark:text-coral-500" role="alert">
      {{ t('stats.loadFailed') }}
    </p>

    <div
      :class="['flex flex-col gap-6 transition-opacity', loading ? 'opacity-50' : '']"
      :aria-busy="loading"
    >
      <!-- Cifras -->
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile :label="t('stats.tiles.total')" :value="formatHours(summary.totalMin)" />
        <StatTile
          :label="t('stats.tiles.days')"
          :value="String(summary.daysWorked)"
          :hint="t('stats.tiles.daysHint', { n: length })"
        />
        <StatTile :label="t('stats.tiles.avg')" :value="formatHours(summary.avgPerWorkedDayMin)" />
        <StatTile :label="t('stats.tiles.tasks')" :value="String(summary.tasksWorked)" />
      </div>

      <p v-if="data && !logs.length" class="m-0 font-text text-sm text-gray-500 dark:text-gray-400">
        {{ t('stats.empty') }}
      </p>

      <div class="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard v-if="length <= 31" :title="t('stats.byDay')" class="xl:col-span-2">
          <ColumnChart :columns="dayColumns" />
        </ChartCard>
        <ChartCard
          v-if="length > 7"
          :title="t('stats.byWeek')"
          :subtitle="t('stats.byWeekHint')"
          class="xl:col-span-2"
        >
          <ColumnChart :columns="weekColumns" />
        </ChartCard>

        <ChartCard :title="t('stats.byProject')">
          <BarList v-if="byProject.length" :items="byProject" :total="summary.totalMin" />
          <p v-else class="m-0 font-text text-sm text-gray-500 dark:text-gray-400">—</p>
        </ChartCard>
        <ChartCard :title="t('stats.byTag')" :subtitle="t('stats.byTagHint')">
          <BarList v-if="byTag.length" :items="byTag" :total="summary.totalMin" />
          <p v-else class="m-0 font-text text-sm text-gray-500 dark:text-gray-400">—</p>
        </ChartCard>

        <ChartCard
          :title="t('stats.heatmap')"
          :subtitle="t('stats.heatmapHint')"
          class="xl:col-span-2"
        >
          <HeatmapChart :weeks="heat" />
        </ChartCard>

        <ChartCard
          :title="t('stats.accuracy.title')"
          :subtitle="t('stats.accuracy.subtitle')"
          class="xl:col-span-2"
        >
          <div
            v-if="accuracy.rows.length || ko.ko"
            class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5"
          >
            <template v-if="accuracy.rows.length">
              <StatTile
                :label="t('stats.accuracy.overTitle')"
                :hint="
                  accuracy.over
                    ? t('stats.accuracy.overHint', {
                        hours: formatHours(accuracy.overMeanMin ?? 0),
                        pct: accuracy.overMeanPct ?? 0,
                      })
                    : t('stats.accuracy.noneOver')
                "
              >
                <template #value>
                  <span class="text-coral-700 dark:text-coral-500">{{ accuracy.over }}</span>
                  <span class="text-base font-normal text-gray-500 dark:text-gray-400">
                    {{ ` ${t('stats.accuracy.ofTotal', { n: accuracy.rows.length })}` }}</span
                  >
                </template>
              </StatTile>
              <StatTile
                :label="t('stats.accuracy.underTitle')"
                :hint="
                  accuracy.under
                    ? t('stats.accuracy.underHint', {
                        hours: formatHours(accuracy.underMeanMin ?? 0),
                        pct: accuracy.underMeanPct ?? 0,
                      })
                    : t('stats.accuracy.noneUnder')
                "
              >
                <template #value>
                  <span class="text-emerald-700 dark:text-emerald-500">{{ accuracy.under }}</span>
                  <span class="text-base font-normal text-gray-500 dark:text-gray-400">
                    {{ ` ${t('stats.accuracy.ofTotal', { n: accuracy.rows.length })}` }}</span
                  >
                </template>
              </StatTile>
              <StatTile
                :label="t('stats.accuracy.onTarget')"
                :hint="t('stats.accuracy.onTargetHint')"
              >
                <template #value>
                  <span>{{ accuracy.onTarget }}</span>
                  <span class="text-base font-normal text-gray-500 dark:text-gray-400">
                    {{ ` ${t('stats.accuracy.ofTotal', { n: accuracy.rows.length })}` }}</span
                  >
                </template>
              </StatTile>
              <StatTile :label="t('stats.accuracy.total')" :hint="totalHint">
                <template #value>
                  <span :class="totalClass">{{ totalValue }}</span>
                </template>
              </StatTile>
            </template>
            <StatTile
              :label="t('stats.ko.label')"
              :value="t('stats.ko.value', { ko: ko.ko, closed: ko.closed })"
              :hint="
                ko.lostMin
                  ? t('stats.ko.hintLost', { pct: ko.pct ?? 0, hours: formatHours(ko.lostMin) })
                  : t('stats.ko.hintNone', { pct: ko.pct ?? 0 })
              "
            />
          </div>
          <AccuracyList v-if="accuracy.rows.length" :rows="accuracy.rows" />
          <p
            v-if="!accuracy.rows.length"
            class="m-0 font-text text-sm text-gray-500 dark:text-gray-400"
          >
            {{ t('stats.accuracy.empty') }}
          </p>
        </ChartCard>
      </div>
    </div>
  </main>
</template>
