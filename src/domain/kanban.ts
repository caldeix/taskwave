import type { DayKey } from './dates'
import { TASK_STATUSES, isClosedStatus, type TaskStatus } from './status'
import type { Task } from './task'

/**
 * Lógica pura del kanban (step-12, D-16, D-17, D-35, D-36).
 */

/** Fecha que manda en el orden y en «atrasada»: la fecha fin o, si no hay, la de inicio. */
export function dueDate(task: Pick<Task, 'startDate' | 'endDate'>): DayKey | null {
  return task.endDate ?? task.startDate
}

/** Atrasada: abierta y con su fecha ya pasada (las cerradas nunca lo están, D-16). */
export function isOverdue(
  task: Pick<Task, 'status' | 'startDate' | 'endDate'>,
  today: DayKey,
): boolean {
  const due = dueDate(task)
  return !isClosedStatus(task.status) && due !== null && due < today
}

/**
 * Orden de una columna (D-35): por fecha (fin o inicio), de la más próxima a la más lejana,
 * así que las atrasadas quedan arriba; las que no tienen fecha, al final. Empates por clave.
 */
export function sortColumn(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const da = dueDate(a)
    const db = dueDate(b)
    if (da !== db) {
      if (da === null) return 1
      if (db === null) return -1
      return da < db ? -1 : 1
    }
    return a.key.localeCompare(b.key, 'es', { numeric: true })
  })
}

/** Reparte las tareas en las 6 columnas, ordenadas con `sorter` (por defecto, el orden de D-35). */
export function groupByStatus(
  tasks: Task[],
  sorter: (tasks: Task[]) => Task[] = sortColumn,
): Record<TaskStatus, Task[]> {
  const columns = Object.fromEntries(TASK_STATUSES.map((s) => [s, [] as Task[]])) as Record<
    TaskStatus,
    Task[]
  >
  for (const task of tasks) columns[task.status].push(task)
  for (const status of TASK_STATUSES) columns[status] = sorter(columns[status])
  return columns
}

/** Cambios de un cambio de estado. `resolvedAt: 'now'` = poner la hora del servidor. */
export interface StatusPatch {
  status: TaskStatus
  resolvedAt?: 'now' | null
  startDate?: DayKey | null
  endDate?: DayKey | null
}

/**
 * Automatismos al cambiar de estado (D-17):
 * - al cerrar (Realizada, Descartada o KO) se guarda cuándo y, si no tenía fecha fin, se le
 *   pone hoy (sin fecha de inicio, pasa a ser una tarea de hoy; si empieza en el futuro, no se
 *   tocan sus fechas para no dejar un fin anterior al inicio);
 * - al reabrir se borra cuándo se cerró;
 * - entre estados abiertos, o entre cerrados, solo cambia el estado.
 * Parar el cronómetro al cerrar llega con el cronómetro (step-19).
 */
export function statusChangePatch(
  task: Pick<Task, 'status' | 'startDate' | 'endDate'>,
  next: TaskStatus,
  today: DayKey,
): StatusPatch {
  const wasClosed = isClosedStatus(task.status)
  const willClose = isClosedStatus(next)
  const patch: StatusPatch = { status: next }
  if (willClose && !wasClosed) {
    patch.resolvedAt = 'now'
    if (!task.startDate) {
      patch.startDate = today
      patch.endDate = null
    } else if (!task.endDate && task.startDate < today) {
      patch.endDate = today
    }
  } else if (!willClose && wasClosed) {
    patch.resolvedAt = null
  }
  return patch
}

/** Días hacia atrás que muestran las columnas cerradas (D-36): 30 → 90 → 365 → todas. */
export const CLOSED_WINDOWS = [30, 90, 365, null] as const
export type ClosedWindow = (typeof CLOSED_WINDOWS)[number]

export function nextClosedWindow(current: ClosedWindow): ClosedWindow {
  const index = CLOSED_WINDOWS.indexOf(current)
  return CLOSED_WINDOWS[Math.min(index + 1, CLOSED_WINDOWS.length - 1)]!
}

/** Desde cuándo (ms) se leen las cerradas; 0 = todas. */
export function closedSinceMs(window: ClosedWindow, now: number = Date.now()): number {
  return window === null ? 0 : now - window * 24 * 60 * 60 * 1000
}
