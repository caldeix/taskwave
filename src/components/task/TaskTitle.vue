<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { MAX_TITLE } from '@/domain/taskCreate'

/**
 * Título editable en el sitio (D-46): se pulsa para editar; Enter o salir del campo guarda;
 * Esc deshace. No se permite dejarlo vacío.
 */
const props = defineProps<{ title: string; disabled?: boolean }>()
const emit = defineEmits<{ save: [title: string] }>()

const { t } = useI18n()
const editing = ref(false)
const draft = ref('')
const input = ref<HTMLTextAreaElement | null>(null)

async function start(): Promise<void> {
  if (props.disabled) return
  draft.value = props.title
  editing.value = true
  await nextTick()
  input.value?.focus()
  input.value?.select()
}

function finish(): void {
  if (!editing.value) return
  editing.value = false
  const value = draft.value.trim().replace(/\s+/g, ' ')
  if (value && value !== props.title) emit('save', value)
}

function cancel(): void {
  editing.value = false
}
</script>

<template>
  <textarea
    v-if="editing"
    ref="input"
    v-model="draft"
    rows="2"
    :maxlength="MAX_TITLE"
    :aria-label="t('taskView.titleLabel')"
    class="w-full resize-none rounded-lg border-0 bg-gray-100 px-3 py-2 font-title text-4xl leading-tight font-semibold text-gray-800 focus:outline-2 focus:outline-blue-500 dark:bg-gray-800 dark:text-white"
    @keydown.enter.prevent="finish"
    @keydown.esc.prevent="cancel"
    @blur="finish"
  />
  <h1 v-else class="m-0">
    <button
      type="button"
      :title="t('taskView.editTitle')"
      class="w-full cursor-text rounded-lg border-0 bg-transparent px-3 py-2 text-left font-title text-4xl leading-tight font-semibold break-words text-gray-800 transition hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-white dark:hover:bg-gray-800"
      @click="start"
    >
      {{ title }}
    </button>
  </h1>
</template>
