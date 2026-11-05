<script setup lang="ts">
import { onBeforeUnmount, ref, useId, watch } from 'vue'

/**
 * Botón que abre un panel flotante (filtros). Se cierra al pulsar fuera o con Esc.
 * El botón va en el slot `button` (recibe `open`); el contenido, en el slot por defecto.
 */
withDefaults(defineProps<{ label: string; align?: 'left' | 'right' }>(), { align: 'left' })

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const panelId = useId()

function onDocumentClick(event: MouseEvent): void {
  if (root.value && !root.value.contains(event.target as Node)) open.value = false
}

watch(open, (isOpen) => {
  if (isOpen) document.addEventListener('click', onDocumentClick, true)
  else document.removeEventListener('click', onDocumentClick, true)
})
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick, true))

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && open.value) {
    open.value = false
    root.value?.querySelector<HTMLButtonElement>('[aria-haspopup]')?.focus()
  }
}
</script>

<template>
  <div ref="root" class="relative" @keydown="onKeydown">
    <button
      type="button"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-controls="panelId"
      :aria-label="label"
      :title="label"
      class="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border-0 bg-gray-200 px-3 font-text text-sm font-bold text-gray-800 transition hover:bg-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 aria-expanded:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 dark:aria-expanded:bg-gray-600"
      @click="open = !open"
    >
      <slot name="button" :open="open" />
    </button>
    <div
      v-if="open"
      :id="panelId"
      role="dialog"
      :aria-label="label"
      :class="[
        'absolute z-30 mt-2 flex w-64 flex-col gap-3 rounded-lg border border-gray-500 bg-white p-4 shadow-lg dark:border-gray-400 dark:bg-gray-900',
        align === 'right' ? 'right-0' : 'left-0',
      ]"
    >
      <slot />
    </div>
  </div>
</template>
