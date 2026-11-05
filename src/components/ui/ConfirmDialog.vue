<script setup lang="ts">
import { ref, useId, watch } from 'vue'
import BaseButton, { type ButtonVariant } from './BaseButton.vue'

/**
 * Diálogo de confirmación con `<dialog>` nativo (gestiona el foco, Esc y el fondo).
 * Se abre con `open = true` y emite `confirm` o `cancel`.
 */
const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    message: string
    confirmLabel: string
    cancelLabel: string
    tone?: ButtonVariant
    busy?: boolean
  }>(),
  { tone: 'danger', busy: false },
)
const emit = defineEmits<{ confirm: []; cancel: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const titleId = useId()

watch(
  () => props.open,
  (open) => {
    if (!dialog.value) return
    if (open && !dialog.value.open) dialog.value.showModal()
    if (!open && dialog.value.open) dialog.value.close()
  },
  { flush: 'post' },
)
</script>

<template>
  <dialog
    ref="dialog"
    class="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-gray-500 bg-white p-6 text-gray-800 backdrop:bg-gray-900/60 dark:border-gray-400 dark:bg-gray-800 dark:text-white"
    :aria-labelledby="titleId"
    @cancel.prevent="emit('cancel')"
  >
    <div class="flex flex-col gap-4">
      <h2
        :id="titleId"
        class="m-0 font-title text-3xl leading-tight font-semibold text-gray-800 dark:text-white"
      >
        {{ title }}
      </h2>
      <p class="m-0 font-text text-sm leading-normal text-gray-500 dark:text-gray-400">
        {{ message }}
      </p>
      <div class="flex flex-wrap justify-end gap-3">
        <BaseButton variant="secondary" :disabled="busy" @click="emit('cancel')">
          {{ cancelLabel }}
        </BaseButton>
        <BaseButton :variant="tone" :disabled="busy" @click="emit('confirm')">
          {{ confirmLabel }}
        </BaseButton>
      </div>
    </div>
  </dialog>
</template>
