<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Bold, Code, Heading2, Italic, Link, List, ListChecks, TextQuote } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import MarkdownView from '@/components/markdown/MarkdownView.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { useMarkdownShortcuts, type MarkdownAction } from '@/composables/useMarkdownShortcuts'
import { useTaskSearch } from '@/composables/useTaskSearch'
import type { Task } from '@/domain/task'

/**
 * Editor de markdown (step-15, D-43): pestañas Escribir / Vista previa, barra de formato y
 * atajos (Ctrl+B, Ctrl+I, Ctrl+K). Ctrl+Enter guarda y Esc cancela. Sirve para la descripción
 * y, en el step-18, para los comentarios. Al escribir una clave (`EST-`) propone las tareas que
 * coinciden; Enter o Tab la completa (v1.1.0, D-3).
 */
const props = withDefaults(
  defineProps<{
    modelValue: string
    label: string
    maxLength?: number
    saving?: boolean
    placeholder?: string
    saveLabel?: string
    autofocus?: boolean
  }>(),
  { maxLength: 50000, saving: false, placeholder: '', saveLabel: '', autofocus: false },
)
const emit = defineEmits<{
  'update:modelValue': [value: string]
  save: []
  cancel: []
}>()

const { t } = useI18n()
const textarea = ref<HTMLTextAreaElement | null>(null)
const tab = ref<'write' | 'preview'>('write')

const { apply, onKeydown: onFormatKey } = useMarkdownShortcuts(textarea, (value) =>
  emit('update:modelValue', value),
)

const tooLong = computed(() => props.modelValue.length > props.maxLength)
const nearLimit = computed(() => props.modelValue.length > props.maxLength * 0.9)

const TOOLS: { action: MarkdownAction; icon: unknown; shortcut?: string }[] = [
  { action: 'bold', icon: Bold, shortcut: 'Ctrl+B' },
  { action: 'italic', icon: Italic, shortcut: 'Ctrl+I' },
  { action: 'heading', icon: Heading2 },
  { action: 'list', icon: List },
  { action: 'checklist', icon: ListChecks },
  { action: 'quote', icon: TextQuote },
  { action: 'code', icon: Code },
  { action: 'link', icon: Link, shortcut: 'Ctrl+K' },
]

function toolLabel(action: MarkdownAction, shortcut?: string): string {
  const name = t(`markdown.tools.${action}`)
  return shortcut ? `${name} (${shortcut})` : name
}

function save(): void {
  if (!tooLong.value && !props.saving) emit('save')
}

// ---- Autocompletado de claves de tarea (v1.1.0) ----
const keyText = ref('')
const keyStart = ref(0)
const keyActive = ref(0)
const { results: keyResults } = useTaskSearch(keyText, { enabled: () => !!keyText.value, max: 6 })
const keyOpen = computed(
  () => tab.value === 'write' && !!keyText.value && keyResults.value.length > 0,
)
const keyListId = `md-keys-${Math.random().toString(36).slice(2, 8)}`

function onInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
  detectKey()
}

/** Busca una clave a medio escribir justo antes del cursor (`EST-`, `est-1`…). */
function detectKey(): void {
  const el = textarea.value
  if (!el || el.selectionStart !== el.selectionEnd) {
    keyText.value = ''
    return
  }
  const before = el.value.slice(0, el.selectionStart)
  const match = /(?:^|[\s([{>*_~])([A-Za-z][A-Za-z0-9]{1,5}-[0-9]{0,7})$/.exec(before)
  keyText.value = match ? match[1]!.toUpperCase() : ''
  keyStart.value = match ? el.selectionStart - match[1]!.length : 0
  keyActive.value = 0
}

function insertKey(task: Task): void {
  const el = textarea.value
  if (!el) return
  const end = el.selectionStart
  const value = `${el.value.slice(0, keyStart.value)}${task.key} ${el.value.slice(end)}`
  emit('update:modelValue', value)
  keyText.value = ''
  const caret = keyStart.value + task.key.length + 1
  void nextTick(() => {
    el.focus()
    el.setSelectionRange(caret, caret)
  })
}

/** Teclas del autocompletado; devuelve `true` si la tecla era suya. */
function onKeyListKey(event: KeyboardEvent): boolean {
  if (!keyOpen.value) return false
  const count = keyResults.value.length
  if (event.key === 'ArrowDown') keyActive.value = (keyActive.value + 1) % count
  else if (event.key === 'ArrowUp') keyActive.value = (keyActive.value - 1 + count) % count
  else if (event.key === 'Enter' || event.key === 'Tab') {
    if (event.ctrlKey || event.metaKey) return false
    const task = keyResults.value[keyActive.value]
    if (task) insertKey(task)
  } else if (event.key === 'Escape') keyText.value = ''
  else return false
  event.preventDefault()
  return true
}

function onKeydown(event: KeyboardEvent): void {
  if (onKeyListKey(event)) return
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('cancel')
  } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    save()
  } else {
    onFormatKey(event)
  }
}

/** Ajusta el alto al contenido (entre 8 líneas y media pantalla). */
function autosize(): void {
  const el = textarea.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(Math.max(el.scrollHeight + 2, 176), window.innerHeight * 0.6)}px`
}

watch(
  () => props.modelValue,
  () => void nextTick(autosize),
)

function focusWrite(): void {
  tab.value = 'write'
  void nextTick(() => {
    autosize()
    textarea.value?.focus()
  })
}

onMounted(() => {
  autosize()
  if (props.autofocus) {
    const el = textarea.value
    el?.focus()
    el?.setSelectionRange(el.value.length, el.value.length)
  }
})

const tabClass = (active: boolean) => [
  '-mb-px cursor-pointer border-0 border-b-2 bg-transparent px-1 pb-2 font-text text-sm transition focus-visible:outline-2 focus-visible:outline-blue-600',
  active
    ? 'border-blue-500 font-bold text-blue-600 dark:text-blue-400'
    : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white',
]
const toolClass =
  'inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-gray-500 transition hover:bg-gray-200 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white'
</script>

<template>
  <div class="flex flex-col gap-2">
    <div
      class="flex flex-wrap items-end justify-between gap-2 border-b border-gray-200 dark:border-gray-700"
    >
      <div class="flex gap-3" role="tablist" :aria-label="label">
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'write'"
          :class="tabClass(tab === 'write')"
          @click="focusWrite"
        >
          {{ t('markdown.write') }}
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'preview'"
          :class="tabClass(tab === 'preview')"
          @click="tab = 'preview'"
        >
          {{ t('markdown.preview') }}
        </button>
      </div>
      <div class="flex flex-wrap pb-1" role="toolbar" :aria-label="t('markdown.toolbar')">
        <button
          v-for="tool in TOOLS"
          :key="tool.action"
          type="button"
          :class="toolClass"
          :disabled="tab !== 'write'"
          :aria-label="toolLabel(tool.action, tool.shortcut)"
          :title="toolLabel(tool.action, tool.shortcut)"
          @click="apply(tool.action)"
        >
          <component :is="tool.icon" class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>

    <textarea
      v-show="tab === 'write'"
      ref="textarea"
      :value="modelValue"
      :aria-label="label"
      :placeholder="placeholder"
      :aria-invalid="tooLong || undefined"
      class="min-h-44 w-full resize-y rounded-lg border border-gray-300 bg-white p-3 font-mono text-sm leading-relaxed text-gray-800 focus:border-blue-500 focus:outline-2 focus:outline-blue-500/30 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
      role="combobox"
      aria-autocomplete="list"
      :aria-expanded="keyOpen"
      :aria-controls="keyListId"
      :aria-activedescendant="keyOpen ? `${keyListId}-${keyActive}` : undefined"
      @input="onInput"
      @click="detectKey"
      @blur="keyText = ''"
      @keydown="onKeydown"
    />
    <ul
      v-show="keyOpen"
      :id="keyListId"
      role="listbox"
      :aria-label="t('markdown.keySuggestions')"
      class="m-0 -mt-1 flex list-none flex-col gap-0.5 rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
    >
      <li
        v-for="(task, index) in keyResults"
        :id="`${keyListId}-${index}`"
        :key="task.id"
        role="option"
        :aria-selected="index === keyActive"
        :class="[
          'flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 font-text text-sm',
          index === keyActive
            ? 'bg-gray-100 dark:bg-gray-800'
            : 'hover:bg-gray-100 dark:hover:bg-gray-800',
        ]"
        @mouseenter="keyActive = index"
        @mousedown.prevent
        @click="insertKey(task)"
      >
        <span class="shrink-0 font-bold text-gray-500 dark:text-gray-400">{{ task.key }}</span>
        <span class="min-w-0 flex-1 truncate text-gray-800 dark:text-white">{{ task.title }}</span>
        <StatusBadge :status="task.status" class="shrink-0 scale-90" />
      </li>
    </ul>
    <div
      v-if="tab === 'preview'"
      class="min-h-44 rounded-lg border border-gray-200 p-3 dark:border-gray-700"
    >
      <MarkdownView v-if="modelValue.trim()" :source="modelValue" readonly />
      <p v-else class="m-0 font-text text-sm text-gray-500 dark:text-gray-400">
        {{ t('markdown.emptyPreview') }}
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <BaseButton :disabled="tooLong || saving" @click="save">
        {{ saving ? t('common.saving') : saveLabel || t('common.save') }}
      </BaseButton>
      <BaseButton variant="ghost" :disabled="saving" @click="emit('cancel')">
        {{ t('common.cancel') }}
      </BaseButton>
      <span class="font-text text-xs text-gray-500 dark:text-gray-400">
        {{ t('markdown.hint') }}
      </span>
      <span
        v-if="nearLimit"
        :class="[
          'ml-auto font-text text-xs',
          tooLong
            ? 'font-bold text-coral-700 dark:text-coral-500'
            : 'text-gray-500 dark:text-gray-400',
        ]"
        aria-live="polite"
      >
        {{ t('markdown.length', { count: modelValue.length, max: maxLength }) }}
      </span>
    </div>
  </div>
</template>
