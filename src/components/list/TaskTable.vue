<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowDown, ArrowUp } from 'lucide-vue-next'
import StatusSelect from '@/components/task/StatusSelect.vue'
import TagChip from '@/components/tags/TagChip.vue'
import { formatHours } from '@/domain/duration'
import type { DayKey } from '@/domain/dates'
import { isOverdue } from '@/domain/kanban'
import { PROJECT_COLOR_CLASSES, type Project } from '@/domain/projects'
import type { TaskStatus } from '@/domain/status'
import { nextSort, sortTable, type SortDir, type TableColumn } from '@/domain/table'
import { tagsOf } from '@/domain/tags'
import { PRIORITIES, type Priority, type Task } from '@/domain/task'
import { useTagsStore } from '@/stores/tags'

/**
 * Vista de lista (plan TASKWAVE-02, ideas 5 y 6, D-6, D-7, CA-5): una tabla con columnas
 * ordenables y edición en la celda (estado, prioridad y fecha fin). La primera columna marca las
 * filas para los cambios en bloque (`v-model:selected`).
 */
const props = defineProps<{
  tasks: Task[]
  today: DayKey
  projectOf?: (task: Task) => Project | undefined
  /** Id de la tarea que se está guardando. */
  savingId?: string | null
}>()
const emit = defineEmits<{
  changeStatus: [task: Task, status: TaskStatus]
  changePriority: [task: Task, priority: Priority]
  changeEndDate: [task: Task, endDate: DayKey | null]
}>()
const selected = defineModel<string[]>('selected', { default: () => [] })

const { t } = useI18n()
const tagsStore = useTagsStore()

const sort = ref<{ column: TableColumn; dir: SortDir }>({ column: 'endDate', dir: 'asc' })
const projectName = (task: Task) => props.projectOf?.(task)?.name ?? ''
const rows = computed(() => sortTable(props.tasks, sort.value.column, sort.value.dir, projectName))

const columns = computed<TableColumn[]>(() => [
  'key',
  'title',
  'status',
  'priority',
  ...(props.projectOf ? (['project'] as const) : []),
  'startDate',
  'endDate',
  'estimate',
  'spent',
])

const allSelected = computed(
  () => props.tasks.length > 0 && props.tasks.every((t) => selected.value.includes(t.id)),
)
const someSelected = computed(() => selected.value.length > 0 && !allSelected.value)

function toggleAll(): void {
  selected.value = allSelected.value ? [] : props.tasks.map((t) => t.id)
}
function toggle(id: string): void {
  selected.value = selected.value.includes(id)
    ? selected.value.filter((s) => s !== id)
    : [...selected.value, id]
}

function ariaSort(column: TableColumn): 'ascending' | 'descending' | 'none' {
  if (sort.value.column !== column) return 'none'
  return sort.value.dir === 'asc' ? 'ascending' : 'descending'
}

const cell = 'border-b border-gray-200 px-2 py-1.5 align-middle dark:border-gray-700'
const inlineControl =
  'h-7 cursor-pointer rounded-md border-0 bg-transparent px-1 font-text text-xs text-gray-800 transition hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-wait dark:text-white dark:hover:bg-gray-700'
</script>

<template>
  <div class="relative -mx-4 overflow-x-auto px-4 md:-mx-8 md:px-8">
    <table class="w-full min-w-[56rem] border-collapse font-text text-sm">
      <caption class="sr-only">
        {{
          t('list.caption', { n: tasks.length })
        }}
      </caption>
      <thead>
        <tr class="text-left">
          <th :class="[cell, 'w-8']" scope="col">
            <input
              type="checkbox"
              class="h-4 w-4 cursor-pointer accent-blue-500"
              :checked="allSelected"
              :indeterminate="someSelected"
              :aria-label="t('list.selectAll')"
              @change="toggleAll"
            />
          </th>
          <th
            v-for="column in columns"
            :key="column"
            :class="[cell, 'whitespace-nowrap']"
            scope="col"
            :aria-sort="ariaSort(column)"
          >
            <button
              type="button"
              class="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-text text-xs font-bold tracking-wide text-gray-500 uppercase hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-gray-400 dark:hover:text-white"
              @click="sort = nextSort(sort, column)"
            >
              {{ t(`list.columns.${column}`) }}
              <ArrowUp
                v-if="sort.column === column && sort.dir === 'asc'"
                class="h-3.5 w-3.5"
                aria-hidden="true"
              />
              <ArrowDown
                v-else-if="sort.column === column"
                class="h-3.5 w-3.5"
                aria-hidden="true"
              />
            </button>
          </th>
          <th
            :class="[cell, 'text-xs font-bold tracking-wide text-gray-500 uppercase']"
            scope="col"
          >
            {{ t('list.columns.tags') }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="task in rows"
          :key="task.id"
          :class="[
            'focus-within:relative focus-within:z-40',
            selected.includes(task.id)
              ? 'bg-blue-500/10'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800',
          ]"
        >
          <td :class="cell">
            <input
              type="checkbox"
              class="h-4 w-4 cursor-pointer accent-blue-500"
              :checked="selected.includes(task.id)"
              :aria-label="t('list.select', { key: task.key })"
              @change="toggle(task.id)"
            />
          </td>
          <td :class="[cell, 'whitespace-nowrap']">
            <RouterLink
              :to="{ name: 'task', params: { taskKey: task.key } }"
              class="font-bold text-blue-600 no-underline hover:underline dark:text-blue-400"
              >{{ task.key }}</RouterLink
            >
          </td>
          <td :class="[cell, 'max-w-80']">
            <RouterLink
              :to="{ name: 'task', params: { taskKey: task.key } }"
              :class="[
                'block truncate text-gray-800 no-underline hover:underline dark:text-white',
                task.status === 'discarded' ? 'line-through opacity-70' : '',
              ]"
              :title="task.title"
              >{{ task.title }}</RouterLink
            >
          </td>
          <td :class="cell">
            <StatusSelect
              compact
              :status="task.status"
              :disabled="savingId === task.id"
              @change="emit('changeStatus', task, $event)"
            />
          </td>
          <td :class="cell">
            <select
              :value="task.priority"
              :class="inlineControl"
              :disabled="savingId === task.id"
              :aria-label="t('list.priorityOf', { key: task.key })"
              @change="
                emit('changePriority', task, ($event.target as HTMLSelectElement).value as Priority)
              "
            >
              <option v-for="p in PRIORITIES" :key="p" :value="p">
                {{ t(`tasks.priority.${p}`) }}
              </option>
            </select>
          </td>
          <td v-if="projectOf" :class="[cell, 'whitespace-nowrap']">
            <span
              v-if="projectOf(task)"
              class="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400"
            >
              <span
                :class="[
                  'h-2 w-2 shrink-0 rounded-full',
                  PROJECT_COLOR_CLASSES[projectOf(task)!.color].dot,
                ]"
                aria-hidden="true"
              />
              {{ projectOf(task)!.name }}
            </span>
            <span v-else class="text-xs text-gray-500 dark:text-gray-400">{{
              t('nav.inbox')
            }}</span>
          </td>
          <td :class="[cell, 'whitespace-nowrap text-xs text-gray-500 dark:text-gray-400']">
            {{ task.startDate ?? '—' }}
          </td>
          <td :class="cell">
            <input
              type="date"
              :value="task.endDate ?? ''"
              :min="task.startDate ?? undefined"
              :disabled="savingId === task.id"
              :aria-label="t('list.endDateOf', { key: task.key })"
              :class="[
                inlineControl,
                isOverdue(task, today) ? 'font-bold text-coral-700 dark:text-coral-500' : '',
              ]"
              @change="
                emit(
                  'changeEndDate',
                  task,
                  (($event.target as HTMLInputElement).value || null) as DayKey | null,
                )
              "
            />
          </td>
          <td :class="[cell, 'whitespace-nowrap text-xs text-gray-500 dark:text-gray-400']">
            {{ task.estimateMin !== null ? formatHours(task.estimateMin) : '—' }}
          </td>
          <td
            :class="[
              cell,
              'whitespace-nowrap text-xs',
              task.estimateMin !== null && task.spentMin > task.estimateMin
                ? 'font-bold text-coral-700 dark:text-coral-500'
                : 'text-gray-500 dark:text-gray-400',
            ]"
          >
            {{ task.spentMin ? formatHours(task.spentMin) : '—' }}
          </td>
          <td :class="cell">
            <span class="flex flex-wrap gap-1">
              <TagChip
                v-for="tag in tagsOf(task.tagIds, tagsStore.all).slice(0, 3)"
                :key="tag.id"
                :tag="tag"
                small
              />
            </span>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="!tasks.length" class="m-0 py-6 font-text text-sm text-gray-500 dark:text-gray-400">
      {{ t('list.empty') }}
    </p>
  </div>
</template>
