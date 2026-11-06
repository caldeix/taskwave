import { formatHours } from './duration'
import { isClosedStatus } from './status'
import type { Task } from './task'
import { computeProgress } from './taskEdit'

/**
 * Franja de tareas iniciadas (step-21, D-33, D-34, CA-14): las abiertas con horas, de la última
 * trabajada a la más antigua, con su % sobre el estimado.
 */

/** Cuántas se leen como mucho (consulta `startedQuery` con límite). */
export const MAX_STARTED = 20

/**
 * Filtra y ordena lo que trae la consulta: solo abiertas con horas > 0 (si se borran todos sus
 * registros, `lastWorkedAt` sigue puesto pero ya no está iniciada), de la última trabajada a la
 * más antigua (D-33; empate por clave).
 */
export function startedTasks(tasks: Task[]): Task[] {
  return tasks
    .filter((t) => !isClosedStatus(t.status) && t.spentMin > 0)
    .sort(
      (a, b) =>
        (b.lastWorkedAtMs ?? 0) - (a.lastWorkedAtMs ?? 0) ||
        a.key.localeCompare(b.key, 'es', { numeric: true }),
    )
}

export interface StartedProgress {
  /** «45 %» o, sin estimado, las horas («3h 30m»). */
  label: string
  /** Ancho de la barra verde, de 0 a 100. */
  width: number
  /** Se ha pasado del estimado (barra en coral). */
  over: boolean
}

export function startedProgress(task: Pick<Task, 'spentMin' | 'estimateMin'>): StartedProgress {
  const p = computeProgress(task.spentMin, task.estimateMin)
  if (!p.hasEstimate || p.percent === null)
    return { label: formatHours(task.spentMin), width: 0, over: false }
  return { label: `${p.percent} %`, width: Math.min(100, p.percent), over: p.percent > 100 }
}
