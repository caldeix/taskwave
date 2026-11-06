import {
  Timestamp,
  collection,
  doc,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type CollectionReference,
  type Firestore,
  type Query,
} from 'firebase/firestore'
import { adjustSpent, type Entry } from '@/domain/worklog'
import { tasksCollection } from './taskQueries'

/**
 * Registro de horas (step-20, D-29). Cada alta, edición o borrado ajusta `spentMin` de la tarea
 * en la misma transacción, así que el total y la lista nunca se desincronizan. Necesitan
 * conexión (transacciones).
 */

export function worklogsCollection(db: Firestore, uid: string): CollectionReference {
  return collection(db, 'users', uid, 'worklogs')
}

/** Registros de una tarea, del día más reciente al más antiguo (índice `taskId, date, startedAt`). */
export function taskWorklogsQuery(db: Firestore, uid: string, taskId: string, max: number): Query {
  return query(
    worklogsCollection(db, uid),
    where('taskId', '==', taskId),
    orderBy('date', 'desc'),
    orderBy('startedAt', 'desc'),
    limit(max),
  )
}

/** Añade una entrada a mano y suma sus minutos a la tarea. Devuelve el id. */
export async function addWorklog(
  db: Firestore,
  uid: string,
  taskId: string,
  entry: Entry,
): Promise<string> {
  const taskRef = doc(tasksCollection(db, uid), taskId)
  const ref = doc(worklogsCollection(db, uid))
  await runTransaction(db, async (tx) => {
    const task = await tx.get(taskRef)
    if (!task.exists()) throw new Error('task-not-found')
    const data = task.data()
    tx.set(ref, {
      taskId,
      projectId: (data.projectId as string | null) ?? null,
      date: entry.date,
      minutes: entry.minutes,
      startedAt: Timestamp.fromMillis(entry.startMs),
      endedAt: Timestamp.fromMillis(entry.endMs),
      source: 'manual',
      note: entry.note,
    })
    const last = (data.lastWorkedAt as Timestamp | null)?.toMillis() ?? 0
    tx.update(taskRef, {
      spentMin: adjustSpent(Number(data.spentMin ?? 0), 0, entry.minutes),
      lastWorkedAt: Timestamp.fromMillis(Math.max(last, entry.endMs)),
      updatedAt: serverTimestamp(),
    })
  })
  return ref.id
}

/** Cambia una entrada (de cronómetro o a mano) y ajusta el total de la tarea con la diferencia. */
export async function updateWorklog(
  db: Firestore,
  uid: string,
  worklogId: string,
  entry: Entry,
): Promise<void> {
  const ref = doc(worklogsCollection(db, uid), worklogId)
  await runTransaction(db, async (tx) => {
    const log = await tx.get(ref)
    if (!log.exists()) throw new Error('worklog-not-found')
    const taskRef = doc(tasksCollection(db, uid), String(log.data().taskId))
    const task = await tx.get(taskRef)
    tx.update(ref, {
      date: entry.date,
      minutes: entry.minutes,
      startedAt: Timestamp.fromMillis(entry.startMs),
      endedAt: Timestamp.fromMillis(entry.endMs),
      note: entry.note,
    })
    if (task.exists())
      tx.update(taskRef, {
        spentMin: adjustSpent(
          Number(task.data().spentMin ?? 0),
          Number(log.data().minutes ?? 0),
          entry.minutes,
        ),
        updatedAt: serverTimestamp(),
      })
  })
}

/** Borra una entrada y resta sus minutos de la tarea (sin bajar de cero). */
export async function deleteWorklog(db: Firestore, uid: string, worklogId: string): Promise<void> {
  const ref = doc(worklogsCollection(db, uid), worklogId)
  await runTransaction(db, async (tx) => {
    const log = await tx.get(ref)
    if (!log.exists()) return
    const taskRef = doc(tasksCollection(db, uid), String(log.data().taskId))
    const task = await tx.get(taskRef)
    tx.delete(ref)
    if (task.exists())
      tx.update(taskRef, {
        spentMin: adjustSpent(
          Number(task.data().spentMin ?? 0),
          Number(log.data().minutes ?? 0),
          0,
        ),
        updatedAt: serverTimestamp(),
      })
  })
}
