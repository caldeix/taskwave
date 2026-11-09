import { fromDayKey, toDayKey, type DayKey } from './dates'
import { isClosedStatus } from './status'
import type { Task } from './task'

/**
 * Backlog con orden manual (plan TASKWAVE-02, idea 8, D-8, CA-8), como el de Jira: las tareas
 * abiertas en dos secciones, «Esta semana» y «Backlog», ordenadas a mano con `rank`.
 *
 * - «Esta semana»: planificadas para esta semana o para una anterior y sin terminar.
 * - El orden es `rank` de menor a mayor; las que aún no tienen van al final, por clave.
 * - Al mover una, se le da un `rank` entre sus vecinas; si alguna vecina no tiene o no queda
 *   hueco, se numera la sección entera (de 1000 en 1000).
 */

export const RANK_STEP = 1000

/** Lunes de la semana de un día (las semanas van de lunes a domingo). */
export function mondayOf(day: DayKey): DayKey {
  const date = fromDayKey(day)
  const offset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - offset)
  return toDayKey(date)
}

const collator = new Intl.Collator('es', { numeric: true })

export function byRank(a: Task, b: Task): number {
  if (a.rank !== null && b.rank !== null && a.rank !== b.rank) return a.rank - b.rank
  if (a.rank !== null && b.rank === null) return -1
  if (a.rank === null && b.rank !== null) return 1
  return collator.compare(a.key, b.key)
}

export interface BacklogSections {
  week: Task[]
  backlog: Task[]
}

export function backlogSections(tasks: Task[], thisMonday: DayKey): BacklogSections {
  const open = tasks.filter((t) => !isClosedStatus(t.status))
  const isWeek = (t: Task) => t.plannedWeek !== null && t.plannedWeek <= thisMonday
  return {
    week: open.filter(isWeek).sort(byRank),
    backlog: open.filter((t) => !isWeek(t)).sort(byRank),
  }
}

export interface RankPatch {
  id: string
  rank: number
}

/**
 * Pone `taskId` en la posición `toIndex` de `list` (la lista de destino, que puede no contenerla)
 * y devuelve los `rank` que hay que guardar: uno solo si cabe entre sus vecinas, o la sección
 * entera renumerada si no.
 */
export function placeAt(list: Task[], task: Task, toIndex: number): RankPatch[] {
  const others = list.filter((t) => t.id !== task.id)
  const index = Math.max(0, Math.min(toIndex, others.length))
  const prev = others[index - 1]
  const next = others[index]
  const prevRank = prev ? prev.rank : null
  const nextRank = next ? next.rank : null

  const fits =
    (!prev || prevRank !== null) &&
    (!next || nextRank !== null) &&
    (prevRank === null || nextRank === null || nextRank - prevRank > 0.000001)
  if (fits) {
    let rank: number
    if (prevRank !== null && nextRank !== null) rank = (prevRank + nextRank) / 2
    else if (prevRank !== null) rank = prevRank + RANK_STEP
    else if (nextRank !== null) rank = nextRank - RANK_STEP
    else rank = RANK_STEP
    return [{ id: task.id, rank }]
  }

  const ordered = [...others.slice(0, index), task, ...others.slice(index)]
  return ordered
    .map((t, i) => ({ id: t.id, rank: (i + 1) * RANK_STEP, before: t.rank }))
    .filter((p) => p.before !== p.rank)
    .map(({ id, rank }) => ({ id, rank }))
}
