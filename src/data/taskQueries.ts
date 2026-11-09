import {
  Timestamp,
  collection,
  documentId,
  getDocs,
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

/** Una tarea por su clave (`EST-12`), para la vista de tarea (step-14). */
export function taskByKeyQuery(db: Firestore, uid: string, key: string): Query {
  return query(tasksCollection(db, uid), where('key', '==', key), limit(1))
}

/** Las últimas tareas tocadas (panel «Para hoy», v1.1.0): por fecha de actualización. */
export function recentQuery(db: Firestore, uid: string, max = 8): Query {
  return query(tasksCollection(db, uid), orderBy('updatedAt', 'desc'), limit(max))
}

/** Tareas por clave, en consultas de 30 como máximo (claves enlazadas en el markdown, v1.1.0). */
export function tasksByKeysQueries(db: Firestore, uid: string, keys: string[]): Query[] {
  const unique = [...new Set(keys)].sort()
  const queries: Query[] = []
  for (let i = 0; i < unique.length; i += 30)
    queries.push(query(tasksCollection(db, uid), where('key', 'in', unique.slice(i, i + 30))))
  return queries
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

/** Subtareas de una tarea (step-16). Una igualdad simple: no necesita índice compuesto. */
export function subtasksQuery(db: Firestore, uid: string, parentId: string): Query {
  return query(tasksCollection(db, uid), where('parentId', '==', parentId))
}

/**
 * Cuántas subtareas tiene una tarea, hasta 2: para las comprobaciones de un solo nivel basta con
 * saber si son 0, 1 o más (v1.0.2).
 */
export async function countSubtasks(db: Firestore, uid: string, parentId: string): Promise<number> {
  return (await getDocs(query(subtasksQuery(db, uid, parentId), limit(2)))).size
}

/**
 * Tareas por id (vinculadas y padre, step-16), en consultas de 30 como máximo, que es el
 * límite de `in` en Firestore.
 */
export function tasksByIdsQueries(db: Firestore, uid: string, ids: string[]): Query[] {
  const unique = [...new Set(ids)].sort()
  const queries: Query[] = []
  for (let i = 0; i < unique.length; i += 30)
    queries.push(
      query(tasksCollection(db, uid), where(documentId(), 'in', unique.slice(i, i + 30))),
    )
  return queries
}
