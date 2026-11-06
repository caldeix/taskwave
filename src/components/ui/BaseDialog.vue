<script setup lang="ts">
import { onMounted, ref, useId, watch } from 'vue'

/**
 * Diálogo modal con `<dialog>` nativo (foco atrapado, Esc y fondo oscurecido).
 * Se abre con `open = true` y emite `close` al pulsar Esc; el contenido va en el slot.
 */
const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ close: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const titleId = useId()

function sync(open: boolean): void {
  if (!dialog.value) return
  if (open && !dialog.value.open) dialog.value.showModal()
  if (!open && dialog.value.open) dialog.value.close()
}

watch(() => props.open, sync, { flush: 'post' })
// Si se monta ya abierto (p. ej. «nueva tarea» con el atajo N desde otra página), se abre aquí.
onMounted(() => sync(props.open))
</script>

<template>
  <dialog
    ref="dialog"
    class="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-lg border border-gray-500 bg-white p-6 text-gray-800 backdrop:bg-gray-900/60 dark:border-gray-400 dark:bg-gray-900 dark:text-white"
    :aria-labelledby="titleId"
    @cancel.prevent="emit('close')"
  >
    <div class="flex flex-col gap-4">
      <h2
        :id="titleId"
        class="m-0 font-title text-3xl leading-tight font-semibold text-gray-800 dark:text-white"
      >
        {{ title }}
      </h2>
      <slot v-if="open" />
    </div>
  </dialog>
</template>
