import { Timestamp, getDocs, query, where, type Firestore, type Query } from 'firebase/firestore'
import { addDaysToKey, fromDayKey, type DayRange } from '@/domain/dates'
import { CLOSED_STATUSES } from '@/domain/status'
import { taskFromData, type Task } from '@/domain/task'
import { worklogFromData, type Worklog } from '@/domain/worklog'
import { tasksByIdsQueries, tasksCollection } from './taskQueries'
import { worklogsCollection } from './worklogs'

/**
 * Lecturas de las estadísticas (step-23). Se leen una vez por periodo (no en vivo): las horas
 * del periodo por fecha, las tareas cerradas en él y las tareas de esas horas (para sus tags).
 * Cuesta una lectura por documento, así que un año entero son unos cientos de lecturas.
 */

/** Registros de horas de un rango de días (índice simple de `date`). */
export function worklogsInRangeQuery(db: Firestore, uid: string, range: DayRange): Query {
  return query(
    worklogsCollection(db, uid),
    where('date', '>=', range.from),
    where('date', '<=', range.to),
  )
}

/** Tareas cerradas dentro del rango (mismo índice `status, resolvedAt` que el kanban). */
export function closedInRangeQuery(db: Firestore, uid: string, range: DayRange): Query {
  return query(
    tasksCollection(db, uid),
    where('status', 'in', [...CLOSED_STATUSES]),
    where('resolvedAt', '>=', Timestamp.fromDate(fromDayKey(range.from))),
    where('resolvedAt', '<', Timestamp.fromDate(fromDayKey(addDaysToKey(range.to, 1)))),
  )
}

export interface StatsData {
  logs: Worklog[]
  /** Tareas con horas en el periodo, por id. */
  tasks: Map<string, Task>
  closed: Task[]
}

export async function loadStats(db: Firestore, uid: string, range: DayRange): Promise<StatsData> {
  const [logSnap, closedSnap] = await Promise.all([
    getDocs(worklogsInRangeQuery(db, uid, range)),
    getDocs(closedInRangeQuery(db, uid, range)),
  ])
  const logs = logSnap.docs.map((d) => worklogFromData(d.id, d.data()))
  const closed = closedSnap.docs.map((d) => taskFromData(d.id, d.data()))

  // Las cerradas ya están leídas: no se vuelven a pedir.
  const tasks = new Map(closed.map((t) => [t.id, t]))
  const missing = [...new Set(logs.map((l) => l.taskId))].filter((id) => !tasks.has(id))
  const snaps = await Promise.all(tasksByIdsQueries(db, uid, missing).map((q) => getDocs(q)))
  for (const snap of snaps) for (const d of snap.docs) tasks.set(d.id, taskFromData(d.id, d.data()))
  return { logs, tasks, closed }
}
