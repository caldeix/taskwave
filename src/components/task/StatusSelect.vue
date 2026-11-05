<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, ChevronDown } from 'lucide-vue-next'
import { STATUS_STYLES, TASK_STATUSES, type TaskStatus } from '@/domain/status'

/** Badge de estado pulsable que abre la lista de estados (vista de tarea, step-14). */
const props = defineProps<{ status: TaskStatus; disabled?: boolean }>()
const emit = defineEmits<{ change: [status: TaskStatus] }>()

const { t } = useI18n()
const open = ref(false)
const root = ref<HTMLElement | null>(null)
const listId = useId()

function onDocumentClick(event: MouseEvent): void {
  if (root.value && !root.value.contains(event.target as Node)) open.value = false
}

watch(open, async (isOpen) => {
  if (isOpen) {
    document.addEventListener('click', onDocumentClick, true)
    await nextTick()
    root.value?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus()
  } else {
    document.removeEventListener('click', onDocumentClick, true)
  }
})
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick, true))

function choose(status: TaskStatus): void {
  open.value = false
  if (status !== props.status) emit('change', status)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') open.value = false
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  event.preventDefault()
  const items = [...(root.value?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])]
  const index = items.indexOf(document.activeElement as HTMLButtonElement)
  items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
}
</script>

<template>
  <div ref="root" class="relative" @keydown="onKeydown">
    <button
      type="button"
      :disabled="disabled"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="listId"
      :aria-label="t('taskView.changeStatus', { status: t(`status.${status}`) })"
      :class="[
        'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border-0 px-3 font-text text-sm font-bold transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait',
        STATUS_STYLES[status].badge,
      ]"
      @click="open = !open"
    >
      {{ t(`status.${status}`) }}
      <ChevronDown class="h-4 w-4" aria-hidden="true" />
    </button>
    <div
      v-if="open"
      :id="listId"
      role="listbox"
      class="absolute left-0 z-30 mt-1 flex min-w-44 flex-col rounded-lg border border-gray-500 bg-white p-1 shadow-lg dark:border-gray-400 dark:bg-gray-900"
    >
      <button
        v-for="option in TASK_STATUSES"
        :key="option"
        type="button"
        role="option"
        :aria-selected="option === status"
        class="flex h-9 cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-3 text-left font-text text-sm text-gray-800 transition hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-white dark:hover:bg-gray-800"
        @click="choose(option)"
      >
        <span
          :class="['h-2.5 w-2.5 shrink-0 rounded-full', STATUS_STYLES[option].dot]"
          aria-hidden="true"
        />
        <span class="flex-1">{{ t(`status.${option}`) }}</span>
        <Check v-if="option === status" class="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
