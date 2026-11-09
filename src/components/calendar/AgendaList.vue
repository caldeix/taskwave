<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, ChevronRight, Plus, Repeat } from 'lucide-vue-next'
import PriorityIcon from '@/components/tasks/PriorityIcon.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { agendaDays } from '@/domain/agenda'
import { fromDayKey, type DayKey } from '@/domain/dates'
import { formatHours } from '@/domain/duration'
import { isOverdue } from '@/domain/kanban'
import type { Task } from '@/domain/task'

/**
 * Agenda del mes para el móvil (step-26, D-24, D-49): los días con tareas u horas (y hoy), cada
 * uno con sus tareas. Sustituye a la rejilla del mes en pantallas estrechas, donde arrastrar no
 * funciona con el dedo: las fechas se cambian desde la vista de la tarea.
 */
const props = defineProps<{
  month: Date
  tasks: Task[]
  today: DayKey
  minutesByDay?: Record<DayKey, number>
  /** Repeticiones futuras de las tareas recurrentes (v1.2.0). */
  ghosts?: Task[]
}>()
const emit = defineEmits<{
  openTask: [task: Task]
  openNew: [day: DayKey]
  changeMonth: [delta: number]
  goToday: []
}>()

const { t, locale } = useI18n()

const title = computed(() => {
  const text = new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric' }).format(
    props.month,
  )
  return text.charAt(0).toUpperCase() + text.slice(1)
})
const dayFmt = computed(
  () => new Intl.DateTimeFormat(locale.value, { weekday: 'long', day: 'numeric', month: 'short' }),
)
const shortFmt = computed(
  () => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short' }),
)
const days = computed(() =>
  agendaDays(props.month, props.tasks, props.today, props.minutesByDay ?? {}, props.ghosts ?? []),
)

/** «→ 12 nov» en las tareas de varios días. */
function span(task: Task): string {
  return task.endDate && task.endDate !== task.startDate
    ? `${shortFmt.value.format(fromDayKey(task.startDate!))} → ${shortFmt.value.format(fromDayKey(task.endDate))}`
    : ''
}
</script>

<template>
  <section class="flex min-w-0 flex-col gap-3" :aria-label="title">
    <header class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="m-0 font-title text-3xl leading-tight font-semibold text-gray-800 dark:text-white">
        {{ title }}
      </h2>
      <div class="flex items-center gap-1">
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

    <p v-if="!days.length" class="m-0 font-text text-sm text-gray-500 dark:text-gray-400">
      {{ t('calendar.agendaEmpty') }}
    </p>

    <ol class="m-0 flex list-none flex-col gap-4 p-0">
      <li v-for="day in days" :key="day.date" class="flex flex-col gap-1.5">
        <div
          :class="[
            'flex items-center gap-2 border-b pb-1',
            day.isToday ? 'border-blue-500' : 'border-gray-200 dark:border-gray-700',
          ]"
        >
          <h3
            :class="[
              'm-0 font-text text-sm font-bold first-letter:uppercase',
              day.isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-white',
            ]"
            :aria-current="day.isToday ? 'date' : undefined"
          >
            {{ dayFmt.format(fromDayKey(day.date)) }}
            <span v-if="day.isToday" class="font-normal">· {{ t('calendar.today') }}</span>
          </h3>
          <span
            v-if="day.minutes"
            class="font-text text-xs text-gray-500 tabular-nums dark:text-gray-400"
            :title="t('calendar.hoursLogged', { hours: formatHours(day.minutes) })"
            >{{ formatHours(day.minutes) }}</span
          >
          <button
            type="button"
            class="ml-auto inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-gray-500 transition hover:bg-gray-200 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
            :aria-label="t('calendar.addOn', { day: dayFmt.format(fromDayKey(day.date)) })"
            @click="emit('openNew', day.date)"
          >
            <Plus class="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <ul v-if="day.tasks.length" class="m-0 flex list-none flex-col gap-1 p-0">
          <li v-for="task in day.tasks" :key="task.id">
            <button
              type="button"
              :class="[
                'flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 py-2 text-left font-text transition hover:border-blue-500 focus-visible:outline-2 focus-visible:outline-blue-600 dark:bg-gray-900',
                isOverdue(task, today)
                  ? 'border-coral-500'
                  : 'border-gray-200 dark:border-gray-700',
              ]"
              @click="emit('openTask', task)"
            >
              <PriorityIcon :priority="task.priority" />
              <span class="flex min-w-0 flex-1 flex-col">
                <span class="truncate text-sm font-medium text-gray-800 dark:text-white">
                  <span class="font-bold text-gray-500 dark:text-gray-400">{{ task.key }}</span>
                  {{ task.title }}
                </span>
                <span v-if="span(task)" class="text-xs text-gray-500 dark:text-gray-400">{{
                  span(task)
                }}</span>
              </span>
              <StatusBadge :status="task.status" class="shrink-0 scale-90" />
            </button>
          </li>
        </ul>
        <ul v-if="day.ghosts.length" class="m-0 flex list-none flex-col gap-1 p-0">
          <li v-for="ghost in day.ghosts" :key="ghost.id">
            <button
              type="button"
              class="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-transparent px-3 py-2 text-left font-text opacity-60 transition hover:opacity-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-gray-600"
              :aria-label="
                t('calendar.ghostLabel', {
                  key: ghost.key,
                  title: ghost.title,
                  date: ghost.startDate,
                })
              "
              @click="emit('openTask', ghost)"
            >
              <Repeat
                class="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400"
                aria-hidden="true"
              />
              <span class="min-w-0 flex-1 truncate text-sm text-gray-800 dark:text-white">{{
                ghost.title
              }}</span>
              <span class="shrink-0 text-xs text-gray-500 dark:text-gray-400">{{
                t('calendar.ghostBadge')
              }}</span>
            </button>
          </li>
        </ul>
        <p
          v-if="!day.tasks.length && !day.ghosts.length"
          class="m-0 pl-1 font-text text-xs text-gray-500 dark:text-gray-400"
        >
          {{ t('calendar.agendaNoTasks') }}
        </p>
      </li>
    </ol>
  </section>
</template>
