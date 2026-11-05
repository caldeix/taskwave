import { addDays as addDaysFns, format, isValid, parse } from 'date-fns'

/**
 * Fechas de día `AAAA-MM-DD` (sin hora ni zona, para que una tarea no cambie de día por la
 * zona horaria). Se comparan como texto: '2026-11-05' < '2026-11-30'.
 */
export type DayKey = string

const DAY_FORMAT = 'yyyy-MM-dd'

/** Fecha local → `AAAA-MM-DD`. */
export function toDayKey(date: Date): DayKey {
  return format(date, DAY_FORMAT)
}

/** `AAAA-MM-DD` → fecha local a las 00:00. */
export function fromDayKey(day: DayKey): Date {
  return parse(day, DAY_FORMAT, new Date(2000, 0, 1))
}

export function isDayKey(value: unknown): value is DayKey {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    isValid(fromDayKey(value)) &&
    toDayKey(fromDayKey(value)) === value
  )
}

export function addDaysToKey(day: DayKey, days: number): DayKey {
  return toDayKey(addDaysFns(fromDayKey(day), days))
}

export function todayKey(now: Date = new Date()): DayKey {
  return toDayKey(now)
}

/** Rango de días cerrado [from, to]. */
export interface DayRange {
  from: DayKey
  to: DayKey
}

/**
 * ¿Se solapa una tarea [start, end] con el rango? Sin fecha fin, la tarea es de un solo día.
 * Es el criterio de los filtros de periodo (D-37) y del calendario.
 */
export function overlaps(start: DayKey | null, end: DayKey | null, range: DayRange): boolean {
  if (!start) return false
  const last = end ?? start
  return start <= range.to && last >= range.from
}
