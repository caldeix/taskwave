import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Peticiones de interfaz que cruzan componentes (step-24): el buscador (`Ctrl+K`) y «nueva
 * tarea» desde un atajo. La vista principal atiende `newTaskRequested` al montarse o al cambiar.
 */
export const useUiStore = defineStore('ui', () => {
  const searchOpen = ref(false)
  const newTaskRequested = ref(false)

  function openSearch(): void {
    searchOpen.value = true
  }

  function requestNewTask(): void {
    newTaskRequested.value = true
  }

  /** La vista principal lo llama al abrir el formulario. */
  function takeNewTaskRequest(): boolean {
    const requested = newTaskRequested.value
    newTaskRequested.value = false
    return requested
  }

  return { searchOpen, newTaskRequested, openSearch, requestNewTask, takeNewTaskRequest }
})
