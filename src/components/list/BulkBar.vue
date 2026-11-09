<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Trash2, X } from 'lucide-vue-next'
import { TASK_STATUSES, type TaskStatus } from '@/domain/status'
import { PRIORITIES, type Priority } from '@/domain/task'
import { useProjectsStore } from '@/stores/projects'
import { useTagsStore } from '@/stores/tags'

/**
 * Barra de cambios en bloque (plan TASKWAVE-02, idea 6, D-7, CA-6): con varias tareas marcadas,
 * cambia a la vez estado, prioridad, proyecto o tags, o las manda a la papelera.
 */
defineProps<{ count: number; busy?: boolean }>()
const emit = defineEmits<{
  status: [status: TaskStatus]
  priority: [priority: Priority]
  project: [projectId: string | null]
  addTag: [tagId: string]
  removeTag: [tagId: string]
  delete: []
  clear: []
}>()

const { t } = useI18n()
const projectsStore = useProjectsStore()
const tagsStore = useTagsStore()
const INBOX = '__inbox__'

/** Cada selector es una acción: al elegir se lanza y vuelve a su texto inicial. */
function pick(event: Event, run: (value: string) => void): void {
  const select = event.target as HTMLSelectElement
  const value = select.value
  select.value = ''
  if (value) run(value)
}

const control =
  'h-8 cursor-pointer rounded-lg border-0 bg-white px-2 font-text text-xs font-bold text-gray-800 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-wait dark:bg-gray-800 dark:text-white'
</script>

<template>
  <div
    class="sticky bottom-4 z-30 flex flex-wrap items-center gap-2 rounded-lg border border-blue-500 bg-blue-50 p-2 shadow-lg dark:bg-gray-900"
    role="toolbar"
    :aria-label="t('list.bulk.label', { n: count })"
  >
    <span class="px-1 font-text text-sm font-bold text-gray-800 dark:text-white" aria-live="polite">
      {{ t('list.bulk.selected', { n: count }) }}
    </span>
    <select
      :class="control"
      :disabled="busy"
      :aria-label="t('list.bulk.status')"
      @change="pick($event, (v) => emit('status', v as TaskStatus))"
    >
      <option value="">{{ t('list.bulk.status') }}</option>
      <option v-for="s in TASK_STATUSES" :key="s" :value="s">{{ t(`status.${s}`) }}</option>
    </select>
    <select
      :class="control"
      :disabled="busy"
      :aria-label="t('list.bulk.priority')"
      @change="pick($event, (v) => emit('priority', v as Priority))"
    >
      <option value="">{{ t('list.bulk.priority') }}</option>
      <option v-for="p in PRIORITIES" :key="p" :value="p">{{ t(`tasks.priority.${p}`) }}</option>
    </select>
    <select
      :class="control"
      :disabled="busy"
      :aria-label="t('list.bulk.project')"
      @change="pick($event, (v) => emit('project', v === INBOX ? null : v))"
    >
      <option value="">{{ t('list.bulk.project') }}</option>
      <option :value="INBOX">{{ t('nav.inbox') }}</option>
      <option v-for="p in projectsStore.active" :key="p.id" :value="p.id">{{ p.name }}</option>
    </select>
    <select
      v-if="tagsStore.all.length"
      :class="control"
      :disabled="busy"
      :aria-label="t('list.bulk.addTag')"
      @change="pick($event, (v) => emit('addTag', v))"
    >
      <option value="">{{ t('list.bulk.addTag') }}</option>
      <option v-for="tag in tagsStore.all" :key="tag.id" :value="tag.id">{{ tag.name }}</option>
    </select>
    <select
      v-if="tagsStore.all.length"
      :class="control"
      :disabled="busy"
      :aria-label="t('list.bulk.removeTag')"
      @change="pick($event, (v) => emit('removeTag', v))"
    >
      <option value="">{{ t('list.bulk.removeTag') }}</option>
      <option v-for="tag in tagsStore.all" :key="tag.id" :value="tag.id">{{ tag.name }}</option>
    </select>
    <button
      type="button"
      class="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-coral-700 px-3 font-text text-xs font-bold text-white hover:bg-coral-500 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-60"
      :disabled="busy"
      @click="emit('delete')"
    >
      <Trash2 class="h-3.5 w-3.5" aria-hidden="true" />
      {{ t('list.bulk.delete') }}
    </button>
    <button
      type="button"
      class="ml-auto inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border-0 bg-transparent px-2 font-text text-xs font-bold text-gray-500 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-gray-400 dark:hover:text-white"
      @click="emit('clear')"
    >
      <X class="h-3.5 w-3.5" aria-hidden="true" />
      {{ t('list.bulk.clear') }}
    </button>
  </div>
</template>
