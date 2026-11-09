<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useTaskKeyStatuses } from '@/composables/useTaskKeyStatuses'
import { renderMarkdown, TASK_KEY_IN_TEXT } from '@/lib/markdown'

/**
 * Markdown formateado (step-15). El HTML sale de `renderMarkdown`, que lo sanea con DOMPurify,
 * así que se puede pintar con `v-html`. Las casillas de las checklists se marcan desde aquí:
 * se emite `toggle` con la línea del texto fuente y quien lo usa guarda el cambio.
 * Las claves de tarea (`EST-12`) son enlaces con el color de su estado y abren la tarea en la
 * app sin recargar (v1.1.0, D-3).
 */
const props = defineProps<{ source: string; readonly?: boolean }>()
const emit = defineEmits<{ toggle: [line: number] }>()

const { t } = useI18n()
const router = useRouter()
const root = ref<HTMLElement | null>(null)
const html = computed(() => renderMarkdown(props.source))

const keys = computed(() => [
  ...new Set(
    [...props.source.matchAll(new RegExp(TASK_KEY_IN_TEXT.source, 'g'))].map((m) => m[1]!),
  ),
])
const statuses = useTaskKeyStatuses(keys)

/** Pinta el estado de cada clave enlazada (punto de color y título al pasar el ratón). */
function paintKeys(): void {
  root.value?.querySelectorAll<HTMLAnchorElement>('a[data-task-key]').forEach((a) => {
    const info = statuses.get(a.dataset.taskKey ?? '')
    if (info) {
      a.dataset.status = info.status
      a.title = `${info.title} · ${t(`status.${info.status}`)}`
    } else {
      delete a.dataset.status
      a.title = info === null ? t('markdown.keyNotFound') : ''
    }
  })
}
watch(
  [html, () => keys.value.map((k) => statuses.get(k)?.status ?? '')],
  () => void nextTick(paintKeys),
  {
    immediate: true,
  },
)

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

/** Las claves abren la tarea con el router; con Ctrl, Mayús o el botón central, otra pestaña. */
function onClick(event: MouseEvent): void {
  const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[data-task-key]')
  if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return
  event.preventDefault()
  void router.push({ name: 'task', params: { taskKey: link.dataset.taskKey } })
}
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- HTML saneado con DOMPurify en renderMarkdown -->
  <div ref="root" class="md-prose" @change="onChange" @click="onClick" v-html="html" />
</template>
