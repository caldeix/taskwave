<script setup lang="ts">
import { computed } from 'vue'
import { renderMarkdown } from '@/lib/markdown'

/**
 * Markdown formateado (step-15). El HTML sale de `renderMarkdown`, que lo sanea con DOMPurify,
 * así que se puede pintar con `v-html`. Las casillas de las checklists se marcan desde aquí:
 * se emite `toggle` con la línea del texto fuente y quien lo usa guarda el cambio.
 */
const props = defineProps<{ source: string; readonly?: boolean }>()
const emit = defineEmits<{ toggle: [line: number] }>()

const html = computed(() => renderMarkdown(props.source))

function onChange(event: Event): void {
  const target = event.target as HTMLElement
  if (!(target instanceof HTMLInputElement) || !target.classList.contains('md-task')) return
  const line = Number(target.dataset.line)
  if (props.readonly || !Number.isInteger(line)) {
    target.checked = !target.checked // sin permiso para cambiarla: se deshace
    return
  }
  emit('toggle', line)
}
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- HTML saneado con DOMPurify en renderMarkdown -->
  <div class="md-prose" @change="onChange" v-html="html" />
</template>
