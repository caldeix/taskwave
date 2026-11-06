<script setup lang="ts">
import { nextTick, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import TaskActivity from '@/components/activity/TaskActivity.vue'
import TaskComments from '@/components/comments/TaskComments.vue'
import TaskWorklog from '@/components/worklog/TaskWorklog.vue'
import type { Task } from '@/domain/task'

/**
 * Pestañas de la vista de tarea: Comentarios (por defecto), Registro de horas y Actividad.
 * Pestañas accesibles (flechas, Inicio y Fin); solo se monta la elegida, así que solo se leen
 * sus datos.
 */
defineProps<{ task: Task }>()

const { t } = useI18n()
const id = useId()

const TABS = ['comments', 'worklog', 'activity'] as const
type TabKey = (typeof TABS)[number]
const selected = ref<TabKey>('comments')
const buttons = ref<HTMLButtonElement[]>([])

function select(tab: TabKey, focus = false): void {
  selected.value = tab
  if (focus) void nextTick(() => buttons.value[TABS.indexOf(tab)]?.focus())
}

function onKeydown(event: KeyboardEvent): void {
  const index = TABS.indexOf(selected.value)
  const next =
    event.key === 'ArrowRight'
      ? (index + 1) % TABS.length
      : event.key === 'ArrowLeft'
        ? (index - 1 + TABS.length) % TABS.length
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? TABS.length - 1
            : null
  if (next === null) return
  event.preventDefault()
  select(TABS[next]!, true)
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <div
      class="flex gap-4 overflow-x-auto border-b border-gray-200 dark:border-gray-700"
      role="tablist"
      :aria-label="t('taskView.tabs.label')"
      @keydown="onKeydown"
    >
      <button
        v-for="tab in TABS"
        :id="`${id}-tab-${tab}`"
        ref="buttons"
        :key="tab"
        type="button"
        role="tab"
        :aria-selected="selected === tab"
        :aria-controls="`${id}-panel-${tab}`"
        :tabindex="selected === tab ? 0 : -1"
        :class="[
          '-mb-px shrink-0 cursor-pointer border-0 border-b-2 bg-transparent px-0 pb-2 font-text text-sm transition focus-visible:outline-2 focus-visible:outline-blue-600',
          selected === tab
            ? 'border-blue-500 font-bold text-blue-600 dark:text-blue-400'
            : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white',
        ]"
        @click="select(tab)"
      >
        {{ t(`taskView.tabs.${tab}`) }}
      </button>
    </div>

    <div :id="`${id}-panel-${selected}`" role="tabpanel" :aria-labelledby="`${id}-tab-${selected}`">
      <TaskComments v-if="selected === 'comments'" :task="task" />
      <TaskWorklog v-else-if="selected === 'worklog'" :task="task" />
      <TaskActivity v-else :task="task" />
    </div>
  </section>
</template>
