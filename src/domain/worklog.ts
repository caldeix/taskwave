import { fromDayKey, isDayKey, type DayKey } from './dates'
import { DEFAULT_HOURS_PER_DAY, parseDuration } from './duration'

/**
 * Registro de horas (`users/{uid}/worklogs/{id}`, step-20, D-29, D-30). Cada entrada es de un
 * solo día (D-27); el cronómetro las crea solo y también se añaden a mano en formato
 * `1d 2h 30m` (1d = la jornada). Lógica pura: las escrituras están en `src/data/worklogs.ts`.
 */

/** Límites de las reglas de Firestore. */
export const MAX_ENTRY_MINUTES = 1440
export const MAX_NOTE = 500

export interface Worklog {
  id: string
  taskId: string
  projectId: string | null
  date: DayKey
  minutes: number
  startedAtMs: number | null
  endedAtMs: number | null
  source: 'timer' | 'manual'
  note: string
}

function millis(value: unknown): number | null {
  return value && typeof (value as { toMillis?: unknown }).toMillis === 'function'
    ? (value as { toMillis: () => number }).toMillis()
    : null
}

export function worklogFromData(id: string, data: Record<string, unknown>): Worklog {
  return {
    id,
    taskId: String(data.taskId ?? ''),
    projectId: (data.projectId as string | null) ?? null,
    date: String(data.date ?? ''),
    minutes: Number(data.minutes ?? 0),
    startedAtMs: millis(data.startedAt),
    endedAtMs: millis(data.endedAt),
    source: data.source === 'timer' ? 'timer' : 'manual',
    note: String(data.note ?? ''),
  }
}

// ---------------------------------------------------------------- entrada a mano

export interface EntryInput {
  date: string
  /** Duración en texto: `1h 30m`, `2h`, `1d`… */
  duration: string
  /** Hora de inicio `HH:mm`. */
  startTime: string
  note: string
}

export interface Entry {
  date: DayKey
  minutes: number
  startMs: number
  endMs: number
  note: string
}

export type EntryErrors = Partial<Record<'date' | 'duration' | 'startTime' | 'note', string>>

/**
 * Valida una entrada a mano y calcula sus datos. Devuelve claves i18n en `errors`.
 * - La fecha no puede ser futura.
 * - La duración va de 1 minuto a 24 h (una entrada es de un solo día).
 */
export function parseEntry(
  input: EntryInput,
  today: DayKey,
  hoursPerDay = DEFAULT_HOURS_PER_DAY,
): { errors: EntryErrors; entry: Entry | null } {
  const errors: EntryErrors = {}
  if (!isDayKey(input.date)) errors.date = 'worklog.errors.date'
  else if (input.date > today) errors.date = 'worklog.errors.future'

  const minutes = parseDuration(input.duration, hoursPerDay)
  if (minutes === null) errors.duration = 'worklog.errors.duration'
  else if (minutes < 1) errors.duration = 'worklog.errors.zero'
  else if (minutes > MAX_ENTRY_MINUTES) errors.duration = 'worklog.errors.tooLong'

  const time = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(input.startTime.trim())
  if (!time) errors.startTime = 'worklog.errors.startTime'

  const note = input.note.trim()
  if (note.length > MAX_NOTE) errors.note = 'worklog.errors.note'

  if (Object.keys(errors).length || minutes === null || !time) return { errors, entry: null }
  const start = fromDayKey(input.date)
  start.setHours(Number(time[1]), Number(time[2]), 0, 0)
  const startMs = start.getTime()
  return {
    errors,
    entry: { date: input.date, minutes, startMs, endMs: startMs + minutes * 60_000, note },
  }
}

/** `HH:mm` de una marca de tiempo, en hora local. */
export function timeOf(ms: number | null): string {
  if (ms === null) return ''
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ---------------------------------------------------------------- agrupado

export interface WorklogDay {
  date: DayKey
  totalMin: number
  logs: Worklog[]
}

/** Agrupa por día, del más reciente al más antiguo, y dentro del día por hora de inicio. */
export function groupByDay(logs: Worklog[]): WorklogDay[] {
  const days = new Map<DayKey, Worklog[]>()
  for (const log of logs) days.set(log.date, [...(days.get(log.date) ?? []), log])
  return [...days.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, list]) => ({
      date,
      totalMin: list.reduce((sum, l) => sum + l.minutes, 0),
      logs: [...list].sort((a, b) => (b.startedAtMs ?? 0) - (a.startedAtMs ?? 0)),
    }))
}

/**
 * Nuevo total de horas de la tarea al cambiar una entrada de `oldMinutes` a `newMinutes`
 * (0 al crear o al borrar). Nunca baja de cero (las reglas no lo permiten).
 */
export function adjustSpent(spentMin: number, oldMinutes: number, newMinutes: number): number {
  return Math.max(0, spentMin - oldMinutes + newMinutes)
}
