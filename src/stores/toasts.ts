import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Toast {
  id: number
  text: string
  tone: 'success' | 'warning' | 'error'
}

/** Avisos breves que desaparecen solos (p. ej. «No se puede eliminar un proyecto con tareas»). */
export const useToastsStore = defineStore('toasts', () => {
  const toasts = ref<Toast[]>([])
  let nextId = 1

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function show(text: string, tone: Toast['tone'] = 'success', ms = 5000): void {
    const id = nextId++
    toasts.value = [...toasts.value.slice(-2), { id, text, tone }]
    setTimeout(() => dismiss(id), ms)
  }

  return { toasts, show, dismiss }
})
