<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Bold, Code, Heading2, Italic, Link, List, ListChecks, TextQuote } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import MarkdownView from '@/components/markdown/MarkdownView.vue'
import { useMarkdownShortcuts, type MarkdownAction } from '@/composables/useMarkdownShortcuts'

/**
 * Editor de markdown (step-15, D-43): pestañas Escribir / Vista previa, barra de formato y
 * atajos (Ctrl+B, Ctrl+I, Ctrl+K). Ctrl+Enter guarda y Esc cancela. Sirve para la descripción
 * y, en el step-18, para los comentarios.
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

function onKeydown(event: KeyboardEvent): void {
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
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      @keydown="onKeydown"
    />
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
