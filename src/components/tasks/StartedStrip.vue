<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronDown, ChevronRight, Timer } from 'lucide-vue-next'
import { useLiveTasks } from '@/composables/useLiveTasks'
import { startedQuery } from '@/data/taskQueries'
import { MAX_STARTED, startedProgress, startedTasks } from '@/domain/started'
import type { TaskScope } from '@/domain/task'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { useTimerStore } from '@/stores/timer'

/**
 * Franja plegable de tareas iniciadas (step-21, D-33, D-34, CA-14): las abiertas con horas del
 * ámbito actual, de la última trabajada a la más antigua, con su % sobre el estimado. Lee como
 * mucho 20 (una consulta acotada) y, plegada, no lee nada. El estado plegado se guarda en el
 * perfil (`prefs.startedCollapsed`).
 */
const props = defineProps<{
  scope: TaskScope
  showProject?: (projectId: string | null) => string
}>()

const { t } = useI18n()
const authStore = useAuthStore()
const profileStore = useProfileStore()
const timer = useTimerStore()

const collapsed = computed(() => profileStore.prefs.startedCollapsed)
const uid = computed(() => authStore.user?.uid ?? null)

const { tasks, loading } = useLiveTasks(() =>
  uid.value && !collapsed.value
    ? {
        key: `started:${uid.value}:${JSON.stringify(props.scope)}`,
        queries: [startedQuery(db, uid.value, props.scope, MAX_STARTED)],
      }
    : null,
)
const started = computed(() => startedTasks(tasks.value))

function toggle(): void {
  void profileStore.updatePrefs({ startedCollapsed: !collapsed.value })
}
</script>

<template>
  <section class="flex flex-col gap-2" :aria-label="t('started.title')">
    <button
      type="button"
      class="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-transparent px-1 py-0.5 font-text text-sm font-bold text-gray-800 transition hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-white dark:hover:bg-gray-800"
      :aria-expanded="!collapsed"
      @click="toggle"
    >
      <ChevronRight v-if="collapsed" class="h-4 w-4" aria-hidden="true" />
      <ChevronDown v-else class="h-4 w-4" aria-hidden="true" />
      {{ t('started.title') }}
      <span v-if="!collapsed && started.length" class="font-normal text-gray-500 dark:text-gray-400"
        >({{ started.length }})</span
      >
    </button>

    <template v-if="!collapsed">
      <p
        v-if="!loading && !started.length"
        class="m-0 pl-1 font-text text-sm text-gray-500 dark:text-gray-400"
      >
        {{ t('started.empty') }}
      </p>
      <ul v-else class="relative m-0 flex list-none gap-3 overflow-x-auto p-0 pb-2">
        <li v-for="task in started" :key="task.id" class="w-56 shrink-0">
          <RouterLink
            :to="{ name: 'task', params: { taskKey: task.key } }"
            class="flex h-full flex-col gap-1.5 rounded-lg border border-gray-200 bg-white p-3 no-underline transition hover:border-blue-500 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-gray-700 dark:bg-gray-900"
          >
            <span
              class="flex items-center gap-1.5 font-text text-xs font-bold text-gray-500 dark:text-gray-400"
            >
              {{ task.key }}
              <span v-if="showProject" class="truncate font-normal"
                >· {{ showProject(task.projectId) }}</span
              >
              <Timer
                v-if="timer.isRunningOn(task.id)"
                class="ml-auto h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-500"
                :aria-label="t('started.running')"
              />
            </span>
            <span
              class="truncate font-text text-sm font-medium text-gray-800 dark:text-white"
              :title="task.title"
              >{{ task.title }}</span
            >
            <span class="flex items-center gap-2">
              <span
                v-if="task.estimateMin"
                class="h-1.5 flex-1 overflow-hidden rounded-full bg-mustard-500"
                aria-hidden="true"
              >
                <span
                  :class="[
                    'block h-full',
                    startedProgress(task).over ? 'bg-coral-500' : 'bg-emerald-500',
                  ]"
                  :style="{ width: `${startedProgress(task).width}%` }"
                />
              </span>
              <span
                :class="[
                  'shrink-0 font-text text-xs tabular-nums',
                  startedProgress(task).over
                    ? 'font-bold text-coral-700 dark:text-coral-500'
                    : 'text-gray-500 dark:text-gray-400',
                  task.estimateMin ? '' : 'ml-auto',
                ]"
              >
                {{
                  task.estimateMin
                    ? startedProgress(task).label
                    : t('started.noEstimate', { hours: startedProgress(task).label })
                }}
              </span>
            </span>
          </RouterLink>
        </li>
      </ul>
    </template>
  </section>
</template>
