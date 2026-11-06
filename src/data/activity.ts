import { collection, limit, orderBy, query, type Firestore, type Query } from 'firebase/firestore'

/**
 * Lectura de la actividad de una tarea (step-22, D-42). Se escribe desde `taskWrites.ts`, en el
 * mismo lote que cada cambio.
 */
export function activityQuery(db: Firestore, uid: string, taskId: string, max: number): Query {
  return query(
    collection(db, 'users', uid, 'tasks', taskId, 'activity'),
    orderBy('at', 'desc'),
    limit(max),
  )
}
