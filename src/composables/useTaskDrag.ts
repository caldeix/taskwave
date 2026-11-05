import { shallowRef } from 'vue'
import type { DayKey } from '@/domain/dates'
import type { Task } from '@/domain/task'

/**
 * Estado compartido del arrastre de una tarea (calendario y panel «Sin fecha», step-11).
 * `grabbedDay` es el día de la barra por el que se cogió (para mantener la posición al soltar);
 * `null` si viene del panel «Sin fecha».
 */
interface DragState {
  task: Task
  grabbedDay: DayKey | null
}

const dragged = shallowRef<DragState | null>(null)

export const TASK_DRAG_TYPE = 'application/x-taskwave-task'

export function useTaskDrag() {
  function start(event: DragEvent, task: Task, grabbedDay: DayKey | null): void {
    dragged.value = { task, grabbedDay }
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData(TASK_DRAG_TYPE, task.id)
      event.dataTransfer.setData('text/plain', `${task.key} ${task.title}`)
    }
  }

  function end(): void {
    dragged.value = null
  }

  return { dragged, start, end }
}
