<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Pencil, Plus, Timer, Trash2, UserPen } from 'lucide-vue-next'
import WorklogForm from './WorklogForm.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import DropdownMenu, { type MenuItem } from '@/components/ui/DropdownMenu.vue'
import { useTaskWorklogs } from '@/composables/useTaskWorklogs'
import { fromDayKey } from '@/domain/dates'
import { formatHours } from '@/domain/duration'
import type { Task } from '@/domain/task'
import { groupByDay, timeOf, type Entry, type Worklog } from '@/domain/worklog'
import { formatDate } from '@/lib/format'
import { useTasksStore } from '@/stores/tasks'
import { useToastsStore } from '@/stores/toasts'

/**
 * Pestaña «Registro de horas» (step-20, CA-13): las horas por día, de la más reciente a la más
 * antigua, con el total de cada día; añadir a mano, editar y borrar. Cada cambio ajusta el total
 * de la tarea (la barra del panel).
 */
const props = defineProps<{ task: Task }>()

const { t, locale } = useI18n()
const tasksStore = useTasksStore()
const toasts = useToastsStore()

const { logs, loading, error, hasMore, more } = useTaskWorklogs(() => props.task.id)
const days = computed(() => groupByDay(logs.value))

const dayFormat = computed(
  () =>
    new Intl.DateTimeFormat(locale.value, {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
)

// ---------------------------------------------------------------- añadir y editar
const adding = ref(false)
const editingId = ref<string | null>(null)
const busy = ref(false)

async function add(entry: Entry): Promise<void> {
  busy.value = true
  try {
    await tasksStore.logHours(props.task, entry)
    toasts.show(t('worklog.logged', { hours: formatHours(entry.minutes) }))
    adding.value = false
  } catch {
    toasts.show(t('worklog.saveFailed'), 'error')
  } finally {
    busy.value = false
  }
}

async function save(log: Worklog, entry: Entry): Promise<void> {
  busy.value = true
  try {
    await tasksStore.editHours(log.id, entry)
    toasts.show(t('worklog.saved'))
    editingId.value = null
  } catch {
    toasts.show(t('worklog.saveFailed'), 'error')
  } finally {
    busy.value = false
  }
}

// ---------------------------------------------------------------- borrar
const deleting = ref<Worklog | null>(null)

async function confirmDelete(): Promise<void> {
  if (!deleting.value) return
  busy.value = true
  try {
    await tasksStore.removeHours(deleting.value.id)
    toasts.show(t('worklog.deleted'))
    deleting.value = null
  } catch {
    toasts.show(t('worklog.saveFailed'), 'error')
  } finally {
    busy.value = false
  }
}

const menu = computed<MenuItem[]>(() => [
  { key: 'edit', label: t('worklog.edit'), icon: Pencil },
  { key: 'delete', label: t('common.delete'), icon: Trash2, danger: true },
])

function onMenu(log: Worklog, key: string): void {
  if (key === 'edit') {
    adding.value = false
    editingId.value = log.id
  } else deleting.value = log
}

function range(log: Worklog): string {
  const from = timeOf(log.startedAtMs)
  const to = timeOf(log.endedAtMs)
  return from && to ? `${from} – ${to}` : from
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-3">
      <span class="font-text text-sm font-bold text-gray-800 dark:text-white">
        {{ t('worklog.total', { hours: formatHours(task.spentMin) }) }}
      </span>
      <BaseButton
        v-if="!adding"
        variant="secondary"
        class="ml-auto"
        @click="((adding = true), (editingId = null))"
      >
        <Plus class="h-4 w-4" aria-hidden="true" />
        {{ t('worklog.add') }}
      </BaseButton>
    </div>

    <WorklogForm v-if="adding" :busy="busy" @submit="add" @cancel="adding = false" />

    <p v-if="error" class="m-0 font-text text-sm text-coral-700 dark:text-coral-500" role="alert">
      {{ t('worklog.loadFailed') }}
    </p>
    <p
      v-else-if="loading && !logs.length"
      class="m-0 font-text text-sm text-gray-500 dark:text-gray-400"
    >
      {{ t('worklog.loading') }}
    </p>
    <p v-else-if="!logs.length" class="m-0 font-text text-sm text-gray-500 dark:text-gray-400">
      {{ t('worklog.empty') }}
    </p>

    <section v-for="day in days" :key="day.date" class="flex flex-col gap-1">
      <h3
        class="m-0 flex items-baseline justify-between gap-2 border-b border-gray-200 pb-1 font-text text-sm font-bold text-gray-800 first-letter:uppercase dark:border-gray-700 dark:text-white"
      >
        <span :title="formatDate(fromDayKey(day.date).getTime())">{{
          dayFormat.format(fromDayKey(day.date))
        }}</span>
        <span class="shrink-0 font-normal text-gray-500 dark:text-gray-400">{{
          t('worklog.dayTotal', { hours: formatHours(day.totalMin) })
        }}</span>
      </h3>
      <ul class="m-0 flex list-none flex-col p-0">
        <li v-for="log in day.logs" :key="log.id" class="py-1">
          <WorklogForm
            v-if="editingId === log.id"
            :initial="log"
            :busy="busy"
            @submit="save(log, $event)"
            @cancel="editingId = null"
          />
          <div
            v-else
            class="flex min-w-0 items-center gap-3 rounded-lg px-2 py-1 font-text text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <span
              class="inline-flex shrink-0 text-gray-500 dark:text-gray-400"
              :title="log.source === 'timer' ? t('worklog.timer') : t('worklog.manual')"
            >
              <Timer v-if="log.source === 'timer'" class="h-4 w-4" aria-hidden="true" />
              <UserPen v-else class="h-4 w-4" aria-hidden="true" />
              <span class="sr-only">{{
                log.source === 'timer' ? t('worklog.timer') : t('worklog.manual')
              }}</span>
            </span>
            <span class="w-16 shrink-0 font-bold text-gray-800 tabular-nums dark:text-white">{{
              formatHours(log.minutes)
            }}</span>
            <span class="shrink-0 text-gray-500 tabular-nums dark:text-gray-400">{{
              range(log)
            }}</span>
            <span class="min-w-0 flex-1 truncate text-gray-800 dark:text-white" :title="log.note">{{
              log.note
            }}</span>
            <DropdownMenu
              :label="t('worklog.actions', { time: range(log) })"
              :items="menu"
              @select="onMenu(log, $event)"
            />
          </div>
        </li>
      </ul>
    </section>

    <div v-if="hasMore">
      <BaseButton variant="ghost" :disabled="loading" @click="more">
        {{ t('worklog.more') }}
      </BaseButton>
    </div>

    <ConfirmDialog
      :open="deleting !== null"
      :title="t('worklog.confirmDelete.title')"
      :message="
        deleting
          ? t('worklog.confirmDelete.message', {
              hours: formatHours(deleting.minutes),
              date: formatDate(fromDayKey(deleting.date).getTime()),
            })
          : ''
      "
      :confirm-label="t('worklog.confirmDelete.confirm')"
      :cancel-label="t('common.cancel')"
      :busy="busy"
      @confirm="confirmDelete"
      @cancel="deleting = null"
    />
  </div>
</template>
