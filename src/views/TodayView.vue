<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlarmClock, CalendarCheck, History, PlayCircle, Sun } from 'lucide-vue-next'
import TaskListRow from '@/components/tasks/TaskListRow.vue'
import { useLiveTasks } from '@/composables/useLiveTasks'
import { openQuery, recentQuery } from '@/data/taskQueries'
import { todayKey } from '@/domain/dates'
import { todaySections } from '@/domain/today'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/stores/auth'
import { useTaskStatusChange } from '@/composables/useTaskStatusChange'

/**
 * Panel «Para hoy» (plan TASKWAVE-02, idea 1, D-2, CA-1): atrasadas, las de hoy, las que están en
 * curso y las últimas tocadas, en vivo. Dos consultas: las abiertas y las 8 últimas actualizadas.
 */
const { t, locale } = useI18n()
const authStore = useAuthStore()
const uid = computed(() => authStore.user?.uid ?? null)
const today = ref(todayKey())
const { saving, changeStatus } = useTaskStatusChange()

const { tasks: open, loading } = useLiveTasks(() =>
  uid.value
    ? { key: `today-open:${uid.value}`, queries: [openQuery(db, uid.value, { kind: 'all' })] }
    : null,
)
const { tasks: recentRaw } = useLiveTasks(() =>
  uid.value ? { key: `today-recent:${uid.value}`, queries: [recentQuery(db, uid.value)] } : null,
)

const sections = computed(() => todaySections(open.value, today.value))
const recent = computed(() =>
  [...recentRaw.value].sort((a, b) => (b.updatedAtMs ?? 0) - (a.updatedAtMs ?? 0)),
)
const dateLabel = computed(() => {
  const text = new Intl.DateTimeFormat(locale.value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())
  return text.charAt(0).toUpperCase() + text.slice(1)
})

const groups = computed(() => [
  {
    id: 'overdue',
    icon: AlarmClock,
    tone: 'text-coral-700 dark:text-coral-500',
    tasks: sections.value.overdue,
  },
  {
    id: 'today',
    icon: CalendarCheck,
    tone: 'text-blue-600 dark:text-blue-400',
    tasks: sections.value.today,
  },
  {
    id: 'inProgress',
    icon: PlayCircle,
    tone: 'text-blue-600 dark:text-blue-400',
    tasks: sections.value.inProgress,
  },
  { id: 'recent', icon: History, tone: 'text-gray-500 dark:text-gray-400', tasks: recent.value },
])
</script>

<template>
  <main class="flex min-w-0 flex-1 flex-col gap-6 px-4 py-6 md:px-8">
    <header class="flex min-w-0 items-center gap-3">
      <span
        class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800"
      >
        <Sun class="h-6 w-6 text-mustard-500" aria-hidden="true" />
      </span>
      <div class="flex min-w-0 flex-col">
        <h1
          class="m-0 w-fit max-w-full truncate bg-radial-blue bg-clip-text font-title text-4xl leading-tight font-semibold text-transparent"
        >
          {{ t('today.title') }}
        </h1>
        <p class="m-0 text-sm text-gray-500 dark:text-gray-400">{{ dateLabel }}</p>
      </div>
    </header>

    <p v-if="loading" class="m-0 font-text text-sm text-gray-500 dark:text-gray-400">
      {{ t('today.loading') }}
    </p>

    <div v-else class="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
      <section
        v-for="group in groups"
        :key="group.id"
        class="flex min-w-0 flex-col gap-2 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
        :aria-labelledby="`today-${group.id}`"
      >
        <h2
          :id="`today-${group.id}`"
          class="m-0 flex items-center gap-2 font-text text-sm font-bold text-gray-800 dark:text-white"
        >
          <component :is="group.icon" :class="['h-4 w-4', group.tone]" aria-hidden="true" />
          {{ t(`today.sections.${group.id}`) }}
          <span class="font-normal text-gray-500 dark:text-gray-400">{{ group.tasks.length }}</span>
        </h2>
        <ul v-if="group.tasks.length" class="m-0 list-none p-0">
          <TaskListRow
            v-for="task in group.tasks"
            :key="task.id"
            :task="task"
            :today="today"
            :busy="saving === task.id"
            @change-status="changeStatus(task, $event)"
          />
        </ul>
        <p v-else class="m-0 px-2 font-text text-sm text-gray-500 dark:text-gray-400">
          {{ t(`today.empty.${group.id}`) }}
        </p>
      </section>
    </div>
  </main>
</template>
