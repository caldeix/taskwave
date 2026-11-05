<script setup lang="ts">
import BaseButton, { type ButtonVariant } from './BaseButton.vue'
import BaseDialog from './BaseDialog.vue'

/** Diálogo de confirmación: emite `confirm` o `cancel` (también con Esc). */
withDefaults(
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
</script>

<template>
  <BaseDialog :open="open" :title="title" @close="emit('cancel')">
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
  </BaseDialog>
</template>
