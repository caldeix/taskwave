import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { addDaysToKey, fromDayKey, toDayKey, type DayKey, type DayRange } from './dates'
import type { Task } from './task'

/**
 * Lógica pura del calendario mensual (step-11, D-20, D-21, D-24).
 * Semanas de lunes a domingo (P-3). Las tareas se pintan como barras que ocupan sus días
 * (las de un día, una celda) repartidas en carriles para que no se solapen, como Google Calendar.
 */

const WEEK = { weekStartsOn: 1 } as const

/** Mes en la URL: `?mes=2026-11`. */
export function parseMonthParam(value: unknown, fallback: Date = new Date()): Date {
  if (typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    const [year, month] = value.split('-').map(Number) as [number, number]
    return new Date(year, month - 1, 1)
  }
  return new Date(fallback.getFullYear(), fallback.getMonth(), 1)
}

export function formatMonthParam(month: Date): string {
  return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
}

export function shiftMonth(month: Date, delta: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + delta, 1)
}

/** Semanas visibles del mes (5 o 6), cada una con sus 7 días de lunes a domingo. */
export function monthGrid(month: Date): DayKey[][] {
  const first = startOfWeek(startOfMonth(month), WEEK)
  const last = endOfWeek(endOfMonth(month), WEEK)
  const days = differenceInCalendarDays(last, first) + 1
  const weeks: DayKey[][] = []
  for (let i = 0; i < days; i += 7) {
    weeks.push(Array.from({ length: 7 }, (_, d) => toDayKey(addDays(first, i + d))))
  }
  return weeks
}

/** Rango de días que se ve en la rejilla (incluye los días de los meses vecinos). */
export function gridRange(weeks: DayKey[][]): DayRange {
  return { from: weeks[0]![0]!, to: weeks[weeks.length - 1]![6]! }
}

export interface WeekSegment {
  task: Task
  /** Columna de inicio (0 = lunes) y número de días que ocupa en esta semana. */
  col: number
  span: number
  lane: number
  /** La tarea viene de la semana anterior o sigue en la siguiente (para redondear las puntas). */
  continuesBefore: boolean
  continuesAfter: boolean
  /** Repetición futura de una tarea recurrente, que aún no existe (v1.2.0). */
  ghost: boolean
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const

/**
 * Reparte las tareas de una semana en carriles. Primero las que empiezan antes y las más largas
 * (como Google Calendar), luego por prioridad y clave, para que el orden sea estable.
 * Las repeticiones fantasma (`ghosts`, v1.2.0) se reparten después, en los huecos que dejan las
 * reales: nunca desplazan una tarea real a «+N más».
 */
export function layoutWeek(week: DayKey[], tasks: Task[], ghosts: Task[] = []): WeekSegment[] {
  const first = week[0]!
  const last = week[6]!
  const piecesOf = (list: Task[], ghost: boolean) =>
    list
      .filter((t) => t.startDate && t.startDate <= last && (t.endDate ?? t.startDate) >= first)
      .map((task) => {
        const start = task.startDate! < first ? first : task.startDate!
        const end =
          (task.endDate ?? task.startDate!) > last ? last : (task.endDate ?? task.startDate!)
        const col = week.indexOf(start)
        const span = week.indexOf(end) - col + 1
        return {
          task,
          col,
          span,
          continuesBefore: task.startDate! < first,
          continuesAfter: (task.endDate ?? task.startDate!) > last,
          ghost,
        }
      })
      .sort(
        (a, b) =>
          a.col - b.col ||
          b.span - a.span ||
          PRIORITY_ORDER[a.task.priority] - PRIORITY_ORDER[b.task.priority] ||
          a.task.key.localeCompare(b.task.key, 'es', { numeric: true }),
      )

  // Cada carril marca sus días ocupados; cada barra va al primer carril libre en sus días.
  const lanes: boolean[][] = []
  const place = (piece: Omit<WeekSegment, 'lane'>): WeekSegment => {
    const cols = Array.from({ length: piece.span }, (_, i) => piece.col + i)
    let lane = lanes.findIndex((used) => cols.every((c) => !used[c]))
    if (lane === -1) {
      lane = lanes.length
      lanes.push(Array.from({ length: 7 }, () => false))
    }
    for (const c of cols) lanes[lane]![c] = true
    return { ...piece, lane }
  }
  return [...piecesOf(tasks, false).map(place), ...piecesOf(ghosts, true).map(place)]
}

/**
 * Cuántas tareas de cada día quedan ocultas por no caber en `maxLanes` carriles («+N más»).
 * Devuelve un array de 7 números (lunes a domingo).
 */
export function hiddenPerDay(segments: WeekSegment[], maxLanes: number): number[] {
  const hidden = Array.from({ length: 7 }, () => 0)
  for (const s of segments) {
    // También las fantasma que no caben, para que no se pierdan (salen en la lista del día).
    if (s.lane < maxLanes) continue
    for (let c = s.col; c < s.col + s.span; c++) hidden[c]!++
  }
  return hidden
}

/** Repeticiones fantasma de un día (en la lista de «+N más», debajo de las reales; v1.2.0). */
export function ghostsOfDay(day: DayKey, segments: WeekSegment[]): Task[] {
  return segments
    .filter(
      (s) => s.ghost && s.task.startDate! <= day && (s.task.endDate ?? s.task.startDate!) >= day,
    )
    .sort((a, b) => a.lane - b.lane)
    .map((s) => s.task)
}

/** Tareas de un día concreto (para el desplegable de «+N más»), en el mismo orden que la rejilla. */
export function tasksOfDay(day: DayKey, segments: WeekSegment[]): Task[] {
  return segments
    .filter((s) => {
      if (s.ghost) return false
      const start = s.task.startDate!
      const end = s.task.endDate ?? start
      return start <= day && end >= day
    })
    .sort((a, b) => a.lane - b.lane)
    .map((s) => s.task)
}

/**
 * Nuevas fechas al arrastrar una tarea (D-21): se mueven inicio y fin manteniendo la duración.
 * `grabbedDay` es el día de la barra por el que se cogió y `dropDay` el día donde se soltó.
 * Una tarea sin fecha (panel «Sin fecha») pasa a ser de un día.
 */
export function moveDates(
  task: Pick<Task, 'startDate' | 'endDate'>,
  grabbedDay: DayKey | null,
  dropDay: DayKey,
): { startDate: DayKey; endDate: DayKey | null } {
  if (!task.startDate) return { startDate: dropDay, endDate: null }
  const delta = differenceInCalendarDays(
    fromDayKey(dropDay),
    fromDayKey(grabbedDay ?? task.startDate),
  )
  return {
    startDate: addDaysToKey(task.startDate, delta),
    endDate: task.endDate ? addDaysToKey(task.endDate, delta) : null,
  }
}
