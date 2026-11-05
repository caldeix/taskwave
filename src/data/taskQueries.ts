import {
  Timestamp,
  collection,
  limit,
  orderBy,
  query,
  where,
  type CollectionReference,
  type Firestore,
  type Query,
  type QueryConstraint,
} from 'firebase/firestore'
import type { DayRange } from '@/domain/dates'
import { CLOSED_STATUSES, type TaskStatus } from '@/domain/status'
import type { TaskScope } from '@/domain/task'

/**
 * Consultas de tareas (step-9). Todas van acotadas (por fechas, estado o límite) para no leer
 * nunca la colección entera y no gastar cuota (R-2). Reciben la instancia de Firestore para poder
 * probarlas contra el emulador (tests/data).
 */

export const OPEN_STATUSES: TaskStatus[] = ['pending', 'in_progress', 'paused']

export function tasksCollection(db: Firestore, uid: string): CollectionReference {
  return collection(db, 'users', uid, 'tasks')
}

/** Filtro del ámbito: todos, la bandeja (sin proyecto) o un proyecto. */
export function scopeConstraints(scope: TaskScope): QueryConstraint[] {
  if (scope.kind === 'inbox') return [where('projectId', '==', null)]
  if (scope.kind === 'project') return [where('projectId', '==', scope.projectId)]
  return []
}

/**
 * Tareas que se solapan con un rango de días (calendario y filtros de periodo, D-37).
 * Firestore no puede comparar con «fin o, si no hay, inicio», así que son dos consultas:
 * 1. las que empiezan dentro del rango;
 * 2. las que empiezan antes y terminan dentro o después (tareas de varios días, D-20).
 */
export function rangeQueries(
  db: Firestore,
  uid: string,
  range: DayRange,
  scope: TaskScope,
): Query[] {
  const col = tasksCollection(db, uid)
  const s = scopeConstraints(scope)
  return [
    query(col, ...s, where('startDate', '>=', range.from), where('startDate', '<=', range.to)),
    query(col, ...s, where('startDate', '<', range.from), where('endDate', '>=', range.from)),
  ]
}

/** Tareas sin fecha de inicio (panel «Sin fecha», D-19). */
export function undatedQuery(db: Firestore, uid: string, scope: TaskScope): Query {
  return query(tasksCollection(db, uid), ...scopeConstraints(scope), where('startDate', '==', null))
}

/** Tareas abiertas (columnas Pendiente, En curso y Paralizada del kanban). */
export function openQuery(db: Firestore, uid: string, scope: TaskScope): Query {
  return query(
    tasksCollection(db, uid),
    ...scopeConstraints(scope),
    where('status', 'in', OPEN_STATUSES),
  )
}

/** Tareas cerradas desde una fecha (columnas cerradas del kanban, D-36). */
export function closedSinceQuery(
  db: Firestore,
  uid: string,
  scope: TaskScope,
  sinceMs: number,
): Query {
  return query(
    tasksCollection(db, uid),
    ...scopeConstraints(scope),
    where('status', 'in', [...CLOSED_STATUSES]),
    where('resolvedAt', '>=', Timestamp.fromMillis(sinceMs)),
  )
}

/**
 * Tareas iniciadas: abiertas y con horas, de la última trabajada a la más antigua (D-33).
 * `lastWorkedAt` solo existe cuando hay horas registradas.
 */
export function startedQuery(db: Firestore, uid: string, scope: TaskScope, max = 20): Query {
  return query(
    tasksCollection(db, uid),
    ...scopeConstraints(scope),
    where('status', 'in', OPEN_STATUSES),
    where('lastWorkedAt', '>', Timestamp.fromMillis(0)),
    orderBy('lastWorkedAt', 'desc'),
    limit(max),
  )
}
