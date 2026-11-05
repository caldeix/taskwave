import { isDayKey, type DayKey } from './dates'
import { INBOX_KEY } from './projects'
import type { TaskStatus } from './status'
import type { Priority, TaskLink } from './task'

/**
 * Alta y borrado de tareas (step-10, D-12, D-13, D-15, D-19, D-51). Lógica pura: la escritura
 * en Firestore está en `src/data/taskWrites.ts`.
 */

export const MAX_TITLE = 200

export interface NewTaskInput {
  title: string
  /** `null` = bandeja «Sin proyecto» (D-11). */
  projectId: string | null
  startDate: DayKey | null
  endDate: DayKey | null
  priority: Priority
  /** Por defecto, Pendiente (D-15). */
  status?: TaskStatus
  estimateMin?: number | null
}

export type NewTaskErrors = Partial<Record<'title' | 'startDate' | 'endDate', string>>

/** Valida el alta. Devuelve claves i18n. Las fechas son opcionales (D-19). */
export function validateNewTask(input: NewTaskInput): NewTaskErrors {
  const errors: NewTaskErrors = {}
  const title = input.title.trim()
  if (!title) errors.title = 'tasks.validation.titleRequired'
  else if (title.length > MAX_TITLE) errors.title = 'tasks.validation.titleTooLong'
  if (input.startDate !== null && !isDayKey(input.startDate))
    errors.startDate = 'tasks.validation.dateInvalid'
  if (input.endDate !== null) {
    if (!isDayKey(input.endDate)) errors.endDate = 'tasks.validation.dateInvalid'
    else if (input.startDate === null) errors.endDate = 'tasks.validation.endWithoutStart'
    else if (input.endDate < input.startDate) errors.endDate = 'tasks.validation.endBeforeStart'
  }
  return errors
}

/** Clave de la siguiente tarea: `EST-12`. Sin proyecto, el prefijo es `INB` (D-11, D-12). */
export function taskKey(projectKey: string | null, counter: number): string {
  return `${projectKey ?? INBOX_KEY}-${counter}`
}

/**
 * Documento de una tarea nueva, con todos los campos que exigen las reglas.
 * `serverNow` es `serverTimestamp()`; `key` sale del contador del proyecto (en transacción).
 */
export function buildNewTask(input: NewTaskInput, key: string, serverNow: unknown) {
  return {
    key,
    projectId: input.projectId,
    title: input.title.trim(),
    description: '',
    status: input.status ?? 'pending',
    priority: input.priority,
    startDate: input.startDate,
    // Una fecha fin igual al inicio no aporta nada: tarea de un solo día.
    endDate: input.endDate && input.endDate !== input.startDate ? input.endDate : null,
    estimateMin: input.estimateMin ?? null,
    spentMin: 0,
    lastWorkedAt: null,
    tagIds: [],
    links: [],
    parentId: null,
    weblinks: [],
    resolvedAt: null,
    createdAt: serverNow,
    updatedAt: serverNow,
  }
}

/** Quita de una lista de vínculos los que apuntan a una tarea (al borrarla, D-13). */
export function removeLinksTo(links: TaskLink[], taskId: string): TaskLink[] {
  return links.filter((link) => link.taskId !== taskId)
}
