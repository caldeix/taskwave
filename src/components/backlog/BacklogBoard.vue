<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown, ArrowUp, CalendarMinus, CalendarPlus, GripVertical } from 'lucide-vue-next'
import TaskListRow from '@/components/tasks/TaskListRow.vue'
import { useTaskStatusChange } from '@/composables/useTaskStatusChange'
import { backlogSections, mondayOf, placeAt, type RankPatch } from '@/domain/backlog'
import type { DayKey } from '@/domain/dates'
import type { Task } from '@/domain/task'
import { useTasksStore } from '@/stores/tasks'
import { useToastsStore } from '@/stores/toasts'

/**
 * Backlog (plan TASKWAVE-02, idea 8, D-8, CA-8): las tareas abiertas en «Esta semana» y «Backlog»,
 * ordenadas a mano. Se arrastran (también de una sección a otra) o se mueven con los botones,
 * que sirven con el teclado.
 */
const props = defineProps<{ tasks: Task[]; today: DayKey }>()

const { t } = useI18n()
const tasksStore = useTasksStore()
const toasts = useToastsStore()
const { saving, changeStatus } = useTaskStatusChange()

const thisMonday = computed(() => mondayOf(props.today))
const sections = computed(() => backlogSections(props.tasks, thisMonday.value))
type SectionId = 'week' | 'backlog'
const SECTIONS: SectionId[] = ['week', 'backlog']

const busy = ref(false)

/** Guarda la nueva posición (y la semana, si cambia de sección). */
async function move(task: Task, to: SectionId, index: number): Promise<void> {
  if (busy.value) return
  const list = sections.value[to]
  const ranks: RankPatch[] = placeAt(list, task, index)
  const plannedWeek = to === 'week' ? thisMonday.value : null
  const weekChanges =
    to === 'week'
      ? task.plannedWeek === null || task.plannedWeek > thisMonday.value
      : task.plannedWeek !== null
  const patches = ranks.map((p) => (p.id === task.id && weekChanges ? { ...p, plannedWeek } : p))
  if (weekChanges && !patches.some((p) => p.id === task.id))
    patches.push({ id: task.id, rank: task.rank ?? 0, plannedWeek })
  busy.value = true
  try {
    await tasksStore.saveBacklog(patches)
    if (weekChanges)
      toasts.show(t(to === 'week' ? 'backlog.planned' : 'backlog.unplanned', { key: task.key }))
  } catch {
    toasts.show(t('taskView.saveFailed'), 'error')
  } finally {
    busy.value = false
  }
}

function step(task: Task, section: SectionId, delta: number): void {
  const list = sections.value[section]
  const index = list.findIndex((x) => x.id === task.id)
  const target = index + delta
  if (target < 0 || target >= list.length) return
  // `placeAt` cuenta la posición sin la propia tarea.
  void move(task, section, target)
}

function toggleWeek(task: Task, section: SectionId): void {
  const to: SectionId = section === 'week' ? 'backlog' : 'week'
  void move(task, to, to === 'week' ? sections.value.week.length : 0)
}

// ---- Arrastrar y soltar ----
const dragged = ref<{ task: Task; from: SectionId } | null>(null)
const dropAt = ref<{ section: SectionId; index: number } | null>(null)

function onDragStart(event: DragEvent, task: Task, from: SectionId): void {
  dragged.value = { task, from }
  event.dataTransfer?.setData('text/plain', task.key)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

/** Índice de inserción según la mitad de la fila sobre la que está el ratón. */
function onDragOverRow(event: DragEvent, section: SectionId, index: number): void {
  if (!dragged.value) return
  event.preventDefault()
  const row = event.currentTarget as HTMLElement
  const rect = row.getBoundingClientRect()
  dropAt.value = { section, index: event.clientY > rect.top + rect.height / 2 ? index + 1 : index }
}

function onDragOverSection(event: DragEvent, section: SectionId): void {
  if (!dragged.value) return
  event.preventDefault()
  if (!dropAt.value || dropAt.value.section !== section)
    dropAt.value = { section, index: sections.value[section].length }
}

function onDrop(event: DragEvent): void {
  event.preventDefault()
  const state = dragged.value
  const target = dropAt.value
  dragged.value = null
  dropAt.value = null
  if (!state || !target) return
  const list = sections.value[target.section]
  // Al bajar dentro de la misma sección, la propia fila ya no ocupa su sitio.
  const from = list.findIndex((x) => x.id === state.task.id)
  const index = from !== -1 && from < target.index ? target.index - 1 : target.index
  if (from === index && state.from === target.section) return
  void move(state.task, target.section, index)
}

function onDragEnd(): void {
  dragged.value = null
  dropAt.value = null
}

const iconButton =
  'inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-gray-500 transition hover:bg-gray-200 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white'
</script>

<template>
  <div class="flex min-w-0 flex-col gap-6">
    <section
      v-for="section in SECTIONS"
      :key="section"
      :class="[
        'flex min-w-0 flex-col gap-2 rounded-lg border p-4 transition',
        dropAt?.section === section
          ? 'border-blue-500 bg-blue-500/5'
          : 'border-gray-200 dark:border-gray-700',
      ]"
      :aria-labelledby="`backlog-${section}`"
      @dragover="onDragOverSection($event, section)"
      @drop="onDrop"
    >
      <h2
        :id="`backlog-${section}`"
        class="m-0 flex items-baseline gap-2 font-text text-sm font-bold text-gray-800 dark:text-white"
      >
        {{ t(`backlog.sections.${section}`) }}
        <span class="font-normal text-gray-500 dark:text-gray-400">{{
          sections[section].length
        }}</span>
        <span
          v-if="section === 'week'"
          class="font-normal text-xs text-gray-500 dark:text-gray-400"
          >{{ t('backlog.weekHint') }}</span
        >
      </h2>

      <ul v-if="sections[section].length" class="m-0 list-none p-0">
        <template v-for="(task, index) in sections[section]" :key="task.id">
          <li
            v-if="dropAt?.section === section && dropAt.index === index"
            class="mx-2 h-0.5 rounded bg-blue-500"
            aria-hidden="true"
          />
          <TaskListRow
            :task="task"
            :today="today"
            :busy="saving === task.id"
            draggable="true"
            :class="dragged?.task.id === task.id ? 'opacity-50' : ''"
            @dragstart="onDragStart($event, task, section)"
            @dragover="onDragOverRow($event, section, index)"
            @dragend="onDragEnd"
            @change-status="changeStatus(task, $event)"
          >
            <template #before>
              <GripVertical
                class="h-4 w-4 shrink-0 cursor-grab text-gray-400 dark:text-gray-500"
                aria-hidden="true"
              />
            </template>
            <template #actions>
              <button
                type="button"
                :class="iconButton"
                :disabled="busy || index === 0"
                :aria-label="t('backlog.up', { key: task.key })"
                :title="t('backlog.up', { key: task.key })"
                @click="step(task, section, -1)"
              >
                <ArrowUp class="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                :class="iconButton"
                :disabled="busy || index === sections[section].length - 1"
                :aria-label="t('backlog.down', { key: task.key })"
                :title="t('backlog.down', { key: task.key })"
                @click="step(task, section, 1)"
              >
                <ArrowDown class="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                :class="iconButton"
                :disabled="busy"
                :aria-label="
                  t(section === 'week' ? 'backlog.unplan' : 'backlog.plan', { key: task.key })
                "
                :title="
                  t(section === 'week' ? 'backlog.unplan' : 'backlog.plan', { key: task.key })
                "
                @click="toggleWeek(task, section)"
              >
                <CalendarMinus v-if="section === 'week'" class="h-4 w-4" aria-hidden="true" />
                <CalendarPlus v-else class="h-4 w-4" aria-hidden="true" />
              </button>
            </template>
          </TaskListRow>
        </template>
        <li
          v-if="dropAt?.section === section && dropAt.index === sections[section].length"
          class="mx-2 h-0.5 rounded bg-blue-500"
          aria-hidden="true"
        />
      </ul>
      <p v-else class="m-0 px-2 py-3 font-text text-sm text-gray-500 dark:text-gray-400">
        {{ t(`backlog.empty.${section}`) }}
      </p>
    </section>
  </div>
</template>
