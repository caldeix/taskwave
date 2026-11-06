<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  CalendarRange,
  Eye,
  EyeOff,
  Flag,
  Settings2,
  Tag,
  X,
} from 'lucide-vue-next'
import PriorityIcon from '@/components/tasks/PriorityIcon.vue'
import PopoverButton from '@/components/ui/PopoverButton.vue'
import TagsDialog from '@/components/tags/TagsDialog.vue'
import { PERIODS, SORTS } from '@/domain/filters'
import { PROJECT_COLOR_CLASSES } from '@/domain/projects'
import { STATUS_STYLES, TASK_STATUSES } from '@/domain/status'
import { PRIORITIES } from '@/domain/task'
import { useFiltersStore } from '@/stores/filters'
import { useTagsStore } from '@/stores/tags'

/**
 * Barra de filtros de la vista principal (step-13). En el calendario el periodo lo marca el mes
 * visible y el orden no aplica, así que esos controles solo salen en el kanban (D-39).
 */
const props = defineProps<{ view: 'calendar' | 'kanban' }>()

const { t } = useI18n()
const store = useFiltersStore()
const tagsStore = useTagsStore()
const tagsDialogOpen = ref(false)

const f = computed(() => store.filters)
const visibleStatuses = computed(() => TASK_STATUSES.length - f.value.hiddenStatuses.length)
const isKanban = computed(() => props.view === 'kanban')

const checkbox =
  'h-4 w-4 cursor-pointer accent-blue-500 focus-visible:outline-2 focus-visible:outline-blue-600'
const optionRow =
  'flex cursor-pointer items-center gap-2 font-text text-sm text-gray-800 dark:text-white'
const chip = (active: boolean) => [
  'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border-0 px-3 font-text text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600',
  active
    ? 'bg-blue-500 text-white hover:bg-blue-600'
    : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600',
]
const legend =
  'mb-1 font-text text-xs font-bold tracking-wider text-gray-500 uppercase dark:text-gray-400'
</script>

<template>
  <div class="flex flex-wrap items-center gap-2" role="toolbar" :aria-label="t('filters.label')">
    <!-- Ojo: estados visibles -->
    <PopoverButton :label="t('filters.statuses')">
      <template #button>
        <Eye v-if="f.hiddenStatuses.length === 0" class="h-4 w-4" aria-hidden="true" />
        <EyeOff v-else class="h-4 w-4 text-coral-700 dark:text-coral-500" aria-hidden="true" />
        <span>{{
          t('filters.statusesShort', { n: visibleStatuses, total: TASK_STATUSES.length })
        }}</span>
      </template>
      <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
        <legend :class="legend">{{ t('filters.statuses') }}</legend>
        <label v-for="status in TASK_STATUSES" :key="status" :class="optionRow">
          <input
            type="checkbox"
            :class="checkbox"
            :checked="!f.hiddenStatuses.includes(status)"
            @change="store.toggleIn('hiddenStatuses', status)"
          />
          <span
            :class="['h-2.5 w-2.5 rounded-full', STATUS_STYLES[status].dot]"
            aria-hidden="true"
          />
          {{ t(`status.${status}`) }}
        </label>
      </fieldset>
    </PopoverButton>

    <!-- Periodo (solo kanban, D-39) -->
    <PopoverButton v-if="isKanban" :label="t('filters.period')">
      <template #button>
        <CalendarRange class="h-4 w-4" aria-hidden="true" />
        <span>{{ t(`filters.periods.${f.period}`) }}</span>
      </template>
      <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
        <legend :class="legend">{{ t('filters.period') }}</legend>
        <label v-for="period in PERIODS" :key="period" :class="optionRow">
          <input
            type="radio"
            name="filter-period"
            :class="checkbox"
            :checked="f.period === period"
            @change="store.update({ period })"
          />
          {{ t(`filters.periods.${period}`) }}
        </label>
        <p class="m-0 font-text text-xs text-gray-500 dark:text-gray-400">
          {{ t('filters.periodHelp') }}
        </p>
      </fieldset>
    </PopoverButton>

    <!-- Orden (solo kanban) -->
    <PopoverButton v-if="isKanban" :label="t('filters.sort')">
      <template #button>
        <ArrowUpNarrowWide v-if="f.sortDir === 'asc'" class="h-4 w-4" aria-hidden="true" />
        <ArrowDownWideNarrow v-else class="h-4 w-4" aria-hidden="true" />
        <span>{{ t(`filters.sorts.${f.sort}`) }}</span>
      </template>
      <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
        <legend :class="legend">{{ t('filters.sort') }}</legend>
        <label v-for="sort in SORTS" :key="sort" :class="optionRow">
          <input
            type="radio"
            name="filter-sort"
            :class="checkbox"
            :checked="f.sort === sort"
            @change="store.update({ sort })"
          />
          {{ t(`filters.sorts.${sort}`) }}
        </label>
      </fieldset>
      <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
        <legend :class="legend">{{ t('filters.direction') }}</legend>
        <label v-for="dir in ['asc', 'desc'] as const" :key="dir" :class="optionRow">
          <input
            type="radio"
            name="filter-dir"
            :class="checkbox"
            :checked="f.sortDir === dir"
            @change="store.update({ sortDir: dir })"
          />
          {{ t(`filters.directions.${dir}`) }}
        </label>
      </fieldset>
    </PopoverButton>

    <!-- Tags (D-40) -->
    <PopoverButton :label="t('filters.tags')">
      <template #button>
        <Tag class="h-4 w-4" aria-hidden="true" />
        <span>{{
          f.tagIds.length
            ? t('filters.tagsCount', { n: f.tagIds.length }, f.tagIds.length)
            : t('filters.tags')
        }}</span>
      </template>
      <p
        v-if="tagsStore.sorted.length === 0"
        class="m-0 font-text text-sm text-gray-500 dark:text-gray-400"
      >
        {{ t('filters.noTags') }}
      </p>
      <template v-else>
        <fieldset class="m-0 flex max-h-56 flex-col gap-2 overflow-y-auto border-0 p-0">
          <legend :class="legend">{{ t('filters.tags') }}</legend>
          <label v-for="tag in tagsStore.sorted" :key="tag.id" :class="optionRow">
            <input
              type="checkbox"
              :class="checkbox"
              :checked="f.tagIds.includes(tag.id)"
              @change="store.toggleIn('tagIds', tag.id)"
            />
            <span
              :class="[
                'h-2.5 w-2.5 rounded-full',
                PROJECT_COLOR_CLASSES[tag.color]?.dot ?? 'bg-gray-500',
              ]"
              aria-hidden="true"
            />
            {{ tag.name }}
          </label>
        </fieldset>
        <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
          <legend :class="legend">{{ t('filters.tagMode') }}</legend>
          <label v-for="mode in ['any', 'all'] as const" :key="mode" :class="optionRow">
            <input
              type="radio"
              name="filter-tag-mode"
              :class="checkbox"
              :checked="f.tagMode === mode"
              @change="store.update({ tagMode: mode })"
            />
            {{ t(`filters.tagModes.${mode}`) }}
          </label>
        </fieldset>
      </template>
      <button
        type="button"
        class="inline-flex w-fit cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 font-text text-xs font-bold text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-blue-400"
        @click="tagsDialogOpen = true"
      >
        <Settings2 class="h-3.5 w-3.5" aria-hidden="true" />
        {{ t('tags.manage') }}
      </button>
    </PopoverButton>
    <TagsDialog :open="tagsDialogOpen" @close="tagsDialogOpen = false" />

    <!-- Prioridad (D-51) -->
    <PopoverButton :label="t('filters.priority')">
      <template #button>
        <Flag class="h-4 w-4" aria-hidden="true" />
        <span>{{
          f.priorities.length
            ? t('filters.priorityCount', { n: f.priorities.length }, f.priorities.length)
            : t('filters.priority')
        }}</span>
      </template>
      <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
        <legend :class="legend">{{ t('filters.priority') }}</legend>
        <label v-for="priority in PRIORITIES" :key="priority" :class="optionRow">
          <input
            type="checkbox"
            :class="checkbox"
            :checked="f.priorities.includes(priority)"
            @change="store.toggleIn('priorities', priority)"
          />
          <PriorityIcon :priority="priority" />
          {{ t(`tasks.priority.${priority}`) }}
        </label>
      </fieldset>
    </PopoverButton>

    <!-- Rápidos: atrasadas y sin fecha (D-37) -->
    <button
      type="button"
      :class="chip(f.quick === 'overdue')"
      :aria-pressed="f.quick === 'overdue'"
      @click="store.update({ quick: f.quick === 'overdue' ? 'none' : 'overdue' })"
    >
      {{ t('filters.overdue') }}
    </button>
    <button
      v-if="isKanban"
      type="button"
      :class="chip(f.quick === 'undated')"
      :aria-pressed="f.quick === 'undated'"
      @click="store.update({ quick: f.quick === 'undated' ? 'none' : 'undated' })"
    >
      {{ t('filters.undated') }}
    </button>

    <button
      v-if="store.activeCount > 0"
      type="button"
      class="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full border-0 bg-transparent px-2 font-text text-xs font-bold text-blue-600 transition hover:text-blue-500 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-blue-400"
      @click="store.clear()"
    >
      <X class="h-3.5 w-3.5" aria-hidden="true" />
      {{ t('filters.clear', { n: store.activeCount }) }}
    </button>
  </div>
</template>
