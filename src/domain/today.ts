import type { DayKey } from './dates'
import { dueDate, isOverdue } from './kanban'
import { isClosedStatus } from './status'
import type { Task } from './task'

/**
 * Panel «Para hoy» (plan TASKWAVE-02, idea 1, D-2), como el «For you» de Jira. Cada tarea abierta
 * sale en una sola sección, en este orden: atrasadas, de hoy y en curso.
 *
 * - Atrasadas: su fecha (fin, o inicio si no tiene fin) ya pasó.
 * - Hoy: su periodo incluye hoy (empieza hoy, termina hoy o está en medio).
 * - En curso: el resto de las que están «En curso».
 */
export interface TodaySections {
  overdue: Task[]
  today: Task[]
  inProgress: Task[]
}

const byDueThenKey = (a: Task, b: Task) =>
  (dueDate(a) ?? '9999').localeCompare(dueDate(b) ?? '9999') ||
  a.key.localeCompare(b.key, 'es', { numeric: true })

export function isToday(task: Pick<Task, 'startDate' | 'endDate'>, today: DayKey): boolean {
  const { startDate, endDate } = task
  if (!startDate && !endDate) return false
  const from = startDate ?? endDate!
  const to = endDate ?? startDate!
  return from <= today && today <= to
}

export function todaySections(tasks: Task[], today: DayKey): TodaySections {
  const sections: TodaySections = { overdue: [], today: [], inProgress: [] }
  for (const task of tasks) {
    if (isClosedStatus(task.status)) continue
    if (isOverdue(task, today)) sections.overdue.push(task)
    else if (isToday(task, today)) sections.today.push(task)
    else if (task.status === 'in_progress') sections.inProgress.push(task)
  }
  sections.overdue.sort(byDueThenKey)
  sections.today.sort(byDueThenKey)
  sections.inProgress.sort(byDueThenKey)
  return sections
}
