import { addDays, addMonths, addWeeks, addYears, differenceInCalendarDays } from 'date-fns'
import { fromDayKey, toDayKey, type DayKey, type DayRange } from './dates'
import { isClosedStatus } from './status'
import type { NewTaskInput } from './taskCreate'
import type { Recurrence, Task } from './task'

/**
 * Tareas recurrentes (plan TASKWAVE-02, idea 9, D-9, CA-9a). Al pasar una tarea con recurrencia
 * a Realizada se crea la siguiente: una copia con las fechas desplazadas (desde las suyas, o desde
 * hoy si no tenía), las casillas de la descripción sin marcar y la recurrencia, que deja la
 * original. Descartada o KO cortan la serie.
 */

/** Opciones del selector «Repetir». */
export const RECURRENCE_PRESETS: Recurrence[] = [
  { freq: 'day', interval: 1 },
  { freq: 'week', interval: 1 },
  { freq: 'week', interval: 2 },
  { freq: 'month', interval: 1 },
  { freq: 'year', interval: 1 },
]

export function recurrenceId(r: Recurrence | null): string {
  return r ? `${r.freq}:${r.interval}` : ''
}

export function parseRecurrenceId(id: string): Recurrence | null {
  return RECURRENCE_PRESETS.find((r) => recurrenceId(r) === id) ?? null
}

export function shiftDay(day: DayKey, r: Recurrence): DayKey {
  const date = fromDayKey(day)
  const shift = { day: addDays, week: addWeeks, month: addMonths, year: addYears }[r.freq]
  return toDayKey(shift(date, r.interval))
}

/** Fechas de la siguiente: mismas que la actual desplazadas, conservando la duración. */
export function nextDates(
  task: Pick<Task, 'startDate' | 'endDate'>,
  r: Recurrence,
  today: DayKey,
): { startDate: DayKey; endDate: DayKey | null } {
  const { startDate, endDate } = task
  if (!startDate && !endDate) return { startDate: shiftDay(today, r), endDate: null }
  if (!startDate) return { startDate: shiftDay(endDate!, r), endDate: null }
  const nextStart = shiftDay(startDate, r)
  if (!endDate) return { startDate: nextStart, endDate: null }
  const days = differenceInCalendarDays(fromDayKey(endDate), fromDayKey(startDate))
  return { startDate: nextStart, endDate: toDayKey(addDays(fromDayKey(nextStart), days)) }
}

/** Desmarca las casillas `- [x]` de una checklist en markdown. */
export function uncheckAll(markdown: string): string {
  return markdown.replace(/^(\s*(?:[-*+]|\d+[.)])\s+)\[[xX]\]/gm, '$1[ ]')
}

/** Datos de la siguiente tarea de la serie. */
export function nextOccurrenceInput(task: Task, today: DayKey): NewTaskInput | null {
  if (!task.recurrence) return null
  return {
    title: task.title,
    projectId: task.projectId,
    ...nextDates(task, task.recurrence, today),
    priority: task.priority,
    estimateMin: task.estimateMin,
    description: uncheckAll(task.description),
    tagIds: [...task.tagIds],
    weblinks: task.weblinks.map((w) => ({ ...w })),
    parentId: task.parentId,
    recurrence: { ...task.recurrence },
  }
}

// ------------------------------------------------- repeticiones «fantasma» (v1.2.0)

/** Separador del id de una repetición fantasma: `<id de la tarea>~<n>`. */
export const GHOST_SEPARATOR = '~'
const MAX_GHOSTS_PER_TASK = 60

/**
 * Próximas repeticiones de las tareas abiertas con recurrencia que caen en `range`, para verlas
 * en el calendario antes de que existan (v1.2.0). Cada una es una copia de la tarea con las
 * fechas de esa repetición (la misma duración) y el id `<id>~<n>`; la propia tarea no se incluye.
 * Las fechas siguen la misma regla que al crear la siguiente (`nextDates`): desde las de la tarea,
 * o desde hoy si no tiene.
 */
export function ghostOccurrences(tasks: Task[], range: DayRange, today: DayKey): Task[] {
  const ghosts: Task[] = []
  for (const task of tasks) {
    const r = task.recurrence
    if (!r || isClosedStatus(task.status)) continue
    let current: Pick<Task, 'startDate' | 'endDate'> = task
    for (let n = 1; n <= MAX_GHOSTS_PER_TASK; n++) {
      const next = nextDates(current, r, today)
      if (next.startDate > range.to) break
      if ((next.endDate ?? next.startDate) >= range.from)
        ghosts.push({ ...task, ...next, id: `${task.id}${GHOST_SEPARATOR}${n}` })
      current = next
    }
  }
  return ghosts
}
