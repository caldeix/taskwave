<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import CalendarTaskBar from './CalendarTaskBar.vue'
import QuickAddForm from './QuickAddForm.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import {
  hiddenPerDay,
  layoutWeek,
  monthGrid,
  moveDates,
  tasksOfDay,
  type WeekSegment,
} from '@/domain/calendar'
import { fromDayKey, type DayKey } from '@/domain/dates'
import { formatHours } from '@/domain/duration'
import type { Task } from '@/domain/task'
import { useTaskDrag } from '@/composables/useTaskDrag'

/**
 * Calendario mensual (step-11): semanas de lunes a domingo, tareas como barras (D-20),
 * arrastrar para cambiar de día (D-21), «+N más», alta rápida al pulsar un día (D-22) y las
 * horas registradas de cada día (step-24, D-52).
 */
const props = defineProps<{
  month: Date
  tasks: Task[]
  today: DayKey
  creating: boolean
  /** Horas registradas de cada día (step-24, D-52). */
  minutesByDay?: Record<DayKey, number>
}>()
const emit = defineEmits<{
  move: [task: Task, dates: { startDate: DayKey; endDate: DayKey | null }]
  quickCreate: [day: DayKey, title: string]
  openNew: [day: DayKey, title: string]
  openTask: [task: Task]
  changeMonth: [delta: number]
  goToday: []
}>()

const { t, locale } = useI18n()
const { dragged, end: endDrag } = useTaskDrag()

/** Carriles visibles por semana antes de «+N más». */
const MAX_LANES = 3

const weeks = computed(() => monthGrid(props.month))
const monthKey = computed(() => {
  const m = props.month
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`
})

interface WeekView {
  days: DayKey[]
  segments: WeekSegment[]
  visible: WeekSegment[]
  hidden: number[]
}

const weekViews = computed<WeekView[]>(() =>
  weeks.value.map((days) => {
    const segments = layoutWeek(days, props.tasks)
    return {
      days,
      segments,
      visible: segments.filter((s) => s.lane < MAX_LANES),
      hidden: hiddenPerDay(segments, MAX_LANES),
    }
  }),
)

const title = computed(() => {
  const text = new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric' }).format(
    props.month,
  )
  return text.charAt(0).toUpperCase() + text.slice(1)
})

/** Lunes a domingo, abreviados («lun», «mar»…). */
const weekdays = computed(() => {
  const fmt = new Intl.DateTimeFormat(locale.value, { weekday: 'short' })
  return weeks.value[0]!.map((day) => fmt.format(fromDayKey(day)).replace('.', ''))
})

const longDay = computed(
  () => new Intl.DateTimeFormat(locale.value, { weekday: 'long', day: 'numeric', month: 'long' }),
)

function dayNumber(day: DayKey): number {
  return Number(day.slice(8))
}

function inMonth(day: DayKey): boolean {
  return day.slice(0, 7) === monthKey.value
}

// ---- Alta rápida (D-22) ----
const quick = ref<{ week: number; col: number; day: DayKey } | null>(null)

function openQuick(week: number, col: number, day: DayKey): void {
  quick.value = { week, col, day }
}

function closeQuick(): void {
  quick.value = null
}

/** «Más opciones»: abre el formulario completo con el día y lo ya escrito. */
function openMore(title: string): void {
  if (quick.value) emit('openNew', quick.value.day, title)
  closeQuick()
}

// Al crear, se cierra el formulario (el padre avisa con `creating` → false).
watch(
  () => props.creating,
  (now, before) => {
    if (before && !now) closeQuick()
  },
)

function onDocumentClick(): void {
  if (quick.value) closeQuick()
}
document.addEventListener('click', onDocumentClick)
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))

// ---- Arrastrar y soltar (D-21) ----
const dropTarget = ref<DayKey | null>(null)

function dayAt(event: DragEvent, week: DayKey[]): DayKey | null {
  const el = event.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const col = Math.floor(((event.clientX - rect.left) / rect.width) * 7)
  return week[Math.min(6, Math.max(0, col))] ?? null
}

function onDragOver(event: DragEvent, week: DayKey[]): void {
  if (!dragged.value) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dropTarget.value = dayAt(event, week)
}

function onDrop(event: DragEvent, week: DayKey[]): void {
  event.preventDefault()
  const state = dragged.value
  const day = dayAt(event, week)
  dropTarget.value = null
  endDrag()
  if (!state || !day) return
  const dates = moveDates(state.task, state.grabbedDay, day)
  if (dates.startDate === state.task.startDate && dates.endDate === state.task.endDate) return
  emit('move', state.task, dates)
}

// ---- «+N más» ----
const dayList = ref<{ day: DayKey; tasks: Task[] } | null>(null)

function openDayList(day: DayKey, week: WeekView): void {
  dayList.value = { day, tasks: tasksOfDay(day, week.segments) }
}
</script>

<template>
  <section class="flex min-w-0 flex-col gap-3" :aria-label="title">
    <header class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="m-0 font-title text-3xl leading-tight font-semibold text-gray-800 dark:text-white">
        {{ title }}
      </h2>
      <div class="flex items-center gap-2">
        <BaseButton variant="secondary" @click="emit('goToday')">{{
          t('calendar.today')
        }}</BaseButton>
        <BaseButton
          variant="ghost"
          :aria-label="t('calendar.prev')"
          @click="emit('changeMonth', -1)"
        >
          <ChevronLeft class="h-5 w-5" aria-hidden="true" />
        </BaseButton>
        <BaseButton
          variant="ghost"
          :aria-label="t('calendar.next')"
          @click="emit('changeMonth', 1)"
        >
          <ChevronRight class="h-5 w-5" aria-hidden="true" />
        </BaseButton>
      </div>
    </header>

    <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      <!-- Días de la semana -->
      <div
        class="grid grid-cols-7 border-b border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800"
      >
        <div
          v-for="(name, i) in weekdays"
          :key="name"
          :class="[
            'py-2 text-center font-text text-xs font-bold tracking-wider text-gray-500 uppercase dark:text-gray-400',
            i >= 5 ? 'text-gray-400 dark:text-gray-500' : '',
          ]"
        >
          {{ name }}
        </div>
      </div>

      <!-- Semanas -->
      <div
        v-for="(week, w) in weekViews"
        :key="week.days[0]"
        class="relative grid min-h-34 grid-cols-7 border-b border-gray-200 last:border-b-0 dark:border-gray-700"
        @dragover="onDragOver($event, week.days)"
        @dragleave="dropTarget = null"
        @drop="onDrop($event, week.days)"
      >
        <!-- Fondo de cada día: se pulsa para crear (D-22) y marca dónde se soltará -->
        <div
          v-for="(day, c) in week.days"
          :key="day"
          role="button"
          tabindex="0"
          :aria-label="t('calendar.addOn', { day: longDay.format(fromDayKey(day)) })"
          :class="[
            'cursor-pointer border-r border-gray-200 transition last:border-r-0 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600 dark:border-gray-700 dark:hover:bg-gray-800',
            c >= 5 ? 'bg-gray-100/60 dark:bg-gray-800/40' : '',
            dropTarget === day
              ? 'bg-blue-500/15 outline-2 outline-offset-[-2px] outline-blue-500 dark:bg-blue-500/20'
              : '',
          ]"
          @click.stop="openQuick(w, c, day)"
          @keydown.enter.prevent="openQuick(w, c, day)"
        />

        <!-- Capa de contenido: número del día, barras y «+N más» -->
        <div
          class="pointer-events-none absolute inset-0 grid grid-cols-7 grid-rows-[1.75rem_repeat(3,1.5rem)_1.5rem] gap-y-0.5 pb-1"
        >
          <span
            v-for="(day, c) in week.days"
            :key="`n-${day}`"
            :style="{ gridColumn: c + 1, gridRow: 1 }"
            class="flex items-start justify-between gap-1 px-1.5 pt-1"
          >
            <span
              v-if="minutesByDay?.[day]"
              class="truncate pt-1 font-text text-[11px] leading-none font-medium text-gray-500 tabular-nums dark:text-gray-400"
              :title="t('calendar.hoursLogged', { hours: formatHours(minutesByDay[day]!) })"
              >{{ formatHours(minutesByDay[day]!) }}</span
            >
            <span v-else />
            <span
              :class="[
                'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 font-text text-xs',
                day === today
                  ? 'bg-blue-500 font-bold text-white'
                  : inMonth(day)
                    ? 'font-medium text-gray-800 dark:text-white'
                    : 'text-gray-400 dark:text-gray-500',
              ]"
              :aria-current="day === today ? 'date' : undefined"
            >
              {{ dayNumber(day) }}
            </span>
          </span>

          <CalendarTaskBar
            v-for="segment in week.visible"
            :key="segment.task.id"
            :segment="segment"
            :week="week.days"
            @open="emit('openTask', segment.task)"
          />

          <template v-for="(count, c) in week.hidden" :key="`h-${c}`">
            <button
              v-if="count > 0"
              type="button"
              class="pointer-events-auto mx-1 cursor-pointer justify-self-start rounded border-0 bg-transparent px-1 font-text text-xs font-bold text-gray-500 transition hover:bg-gray-200 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
              :style="{ gridColumn: c + 1, gridRow: MAX_LANES + 2 }"
              @click.stop="openDayList(week.days[c]!, week)"
            >
              {{ t('calendar.more', { n: count }) }}
            </button>
          </template>
        </div>

        <!-- Formulario de alta rápida en el día pulsado -->
        <div
          v-if="quick && quick.week === w"
          class="absolute top-8 z-20"
          :style="
            quick.col >= 4
              ? { right: `${((6 - quick.col) / 7) * 100}%` }
              : { left: `${(quick.col / 7) * 100}%` }
          "
        >
          <QuickAddForm
            :day-label="longDay.format(fromDayKey(quick.day))"
            :busy="creating"
            @create="emit('quickCreate', quick.day, $event)"
            @more="openMore"
            @close="closeQuick"
          />
        </div>
      </div>
    </div>

    <!-- Todas las tareas de un día («+N más») -->
    <BaseDialog
      :open="dayList !== null"
      :title="dayList ? longDay.format(fromDayKey(dayList.day)) : ''"
      @close="dayList = null"
    >
      <ul v-if="dayList" class="m-0 flex list-none flex-col gap-1 p-0">
        <li v-for="task in dayList.tasks" :key="task.id">
          <!-- Cada tarea lleva a su vista (también con Ctrl+clic o clic central, en otra pestaña) -->
          <RouterLink
            :to="{ name: 'task', params: { taskKey: task.key } }"
            class="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-gray-800 no-underline transition hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-white dark:hover:bg-gray-800"
          >
            <span
              class="w-16 shrink-0 font-text text-sm font-bold text-blue-600 dark:text-blue-400"
            >
              {{ task.key }}
            </span>
            <span class="min-w-0 flex-1 truncate font-text text-sm">{{ task.title }}</span>
            <StatusBadge :status="task.status" class="shrink-0" />
          </RouterLink>
        </li>
      </ul>
      <div class="flex justify-end">
        <BaseButton variant="secondary" @click="dayList = null">{{
          t('calendar.close')
        }}</BaseButton>
      </div>
    </BaseDialog>
  </section>
</template>
