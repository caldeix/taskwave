<script setup lang="ts">
import { onScopeDispose, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowRight } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useTaskActivity } from '@/composables/useTaskActivity'
import type { ActivityEntry, ActivityValue } from '@/domain/activity'
import { fromDayKey, isDayKey } from '@/domain/dates'
import { formatDuration } from '@/domain/duration'
import type { Task } from '@/domain/task'
import { formatDate, formatDateTime, formatRelative } from '@/lib/format'
import { useProfileStore } from '@/stores/profile'
import { useProjectsStore } from '@/stores/projects'

/**
 * Pestaña «Actividad» (step-22, D-42, CA-16): los cambios de estado, fechas, estimado,
 * prioridad, proyecto y título, con su fecha, de lo más reciente a lo más antiguo.
 */
const props = defineProps<{ task: Task }>()

const { t, te } = useI18n()
const profileStore = useProfileStore()
const projectsStore = useProjectsStore()

const { entries, loading, error, hasMore, more } = useTaskActivity(() => props.task.id)

const now = ref(Date.now())
const timer = setInterval(() => (now.value = Date.now()), 60_000)
onScopeDispose(() => clearInterval(timer))

function fieldLabel(entry: ActivityEntry): string {
  const key = `activity.fields.${entry.field}`
  return te(key) ? t(key) : entry.field
}

/** Valor legible de un campo (estado y prioridad traducidos, fechas, duraciones, proyectos). */
function value(entry: ActivityEntry, v: ActivityValue): string {
  switch (entry.field) {
    case 'status':
      return v ? t(`status.${v}`) : '—'
    case 'priority':
      return v ? t(`activity.priority.${v}`) : '—'
    case 'startDate':
    case 'endDate':
      return typeof v === 'string' && isDayKey(v)
        ? formatDate(fromDayKey(v).getTime())
        : t('activity.noDate')
    case 'estimateMin':
      return typeof v === 'number'
        ? formatDuration(v, profileStore.prefs.hoursPerDay)
        : t('activity.noEstimate')
    case 'projectId':
      return v === null
        ? t('nav.inbox')
        : (projectsStore.byId(String(v))?.name ?? t('activity.deletedProject'))
    default:
      return v === null ? '—' : String(v)
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <p v-if="error" class="m-0 font-text text-sm text-coral-700 dark:text-coral-500" role="alert">
      {{ t('activity.loadFailed') }}
    </p>
    <p
      v-else-if="loading && !entries.length"
      class="m-0 font-text text-sm text-gray-500 dark:text-gray-400"
    >
      {{ t('activity.loading') }}
    </p>
    <p v-else-if="!entries.length" class="m-0 font-text text-sm text-gray-500 dark:text-gray-400">
      {{ t('activity.empty') }}
    </p>

    <ol v-if="entries.length" class="m-0 flex list-none flex-col p-0">
      <li
        v-for="entry in entries"
        :key="entry.id"
        class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-l-2 border-gray-200 py-1.5 pl-3 font-text text-sm dark:border-gray-700"
      >
        <template v-if="entry.field === 'created'">
          <span class="font-bold text-gray-800 dark:text-white">{{
            t('activity.created', { key: entry.to })
          }}</span>
        </template>
        <template v-else>
          <span class="font-bold text-gray-800 dark:text-white">{{ fieldLabel(entry) }}</span>
          <span class="inline-flex min-w-0 flex-wrap items-baseline gap-1.5">
            <span class="text-gray-500 line-through decoration-gray-400 dark:text-gray-400">{{
              value(entry, entry.from)
            }}</span>
            <ArrowRight class="h-3.5 w-3.5 shrink-0 self-center text-gray-500" aria-hidden="true" />
            <span class="sr-only">{{ t('activity.to') }}</span>
            <span class="text-gray-800 dark:text-white">{{ value(entry, entry.to) }}</span>
          </span>
        </template>
        <time
          class="ml-auto shrink-0 text-xs text-gray-500 dark:text-gray-400"
          :title="formatDateTime(entry.atMs)"
          :datetime="entry.atMs ? new Date(entry.atMs).toISOString() : undefined"
          >{{ formatRelative(entry.atMs, now) }}</time
        >
      </li>
    </ol>

    <div v-if="hasMore">
      <BaseButton variant="ghost" :disabled="loading" @click="more">
        {{ t('activity.more') }}
      </BaseButton>
    </div>
  </div>
</template>
