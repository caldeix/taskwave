import { endOfMonth, startOfMonth } from 'date-fns'
import { addDaysToKey, toDayKey, type DayKey } from './dates'
import type { Task } from './task'

/**
 * Agenda del móvil (step-26, D-24, D-49): en lugar de la rejilla del mes, una lista de los días
 * del mes con sus tareas. Solo salen los días con tareas u horas, y siempre hoy si es de ese mes.
 * Una tarea de varios días sale en cada uno de sus días.
 */

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const

export interface AgendaDay {
  date: DayKey
  tasks: Task[]
  minutes: number
  isToday: boolean
}

/** Último día de la tarea: su fin o, si no tiene, el de inicio (tarea de un día). */
function lastDay(task: Task): DayKey | null {
  return task.endDate ?? task.startDate
}

export function agendaDays(
  month: Date,
  tasks: Task[],
  today: DayKey,
  minutesByDay: Record<DayKey, number> = {},
): AgendaDay[] {
  const from = toDayKey(startOfMonth(month))
  const to = toDayKey(endOfMonth(month))
  const byDay = new Map<DayKey, Task[]>()
  for (const task of tasks) {
    const start = task.startDate
    const end = lastDay(task)
    if (!start || !end) continue
    for (let d = start < from ? from : start; d <= end && d <= to; d = addDaysToKey(d, 1))
      byDay.set(d, [...(byDay.get(d) ?? []), task])
  }
  const days = new Set<DayKey>([...byDay.keys()])
  for (const [d, m] of Object.entries(minutesByDay)) if (m > 0 && d >= from && d <= to) days.add(d)
  if (today >= from && today <= to) days.add(today)
  return [...days].sort().map((date) => ({
    date,
    tasks: (byDay.get(date) ?? []).sort(
      (a, b) =>
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        a.key.localeCompare(b.key, 'es', { numeric: true }),
    ),
    minutes: minutesByDay[date] ?? 0,
    isToday: date === today,
  }))
}
