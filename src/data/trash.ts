import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type Firestore,
  type Query,
} from 'firebase/firestore'
import { inverseLink } from '@/domain/links'
import type { TaskLink } from '@/domain/task'
import { commitInBatches, type Op } from './taskWrites'
import { tasksCollection } from './taskQueries'

/**
 * Papelera (plan TASKWAVE-02, idea 10, D-11, CA-10b) en `users/{uid}/trash/{taskId}`: la tarea
 * borrada con sus comentarios y horas. Se restaura durante 30 días; después se borra sola al
 * abrir la papelera.
 */
export const TRASH_DAYS = 30

export interface TrashEntry {
  id: string
  key: string
  title: string
  deletedAtMs: number | null
  comments: number
  worklogs: number
}

export function trashQuery(db: Firestore, uid: string): Query {
  return query(collection(db, 'users', uid, 'trash'), orderBy('deletedAt', 'desc'))
}

export function trashEntryFromData(id: string, data: Record<string, unknown>): TrashEntry {
  const task = (data.task ?? {}) as Record<string, unknown>
  const deletedAt = data.deletedAt as Timestamp | null | undefined
  return {
    id,
    key: String(task.key ?? ''),
    title: String(task.title ?? ''),
    deletedAtMs: deletedAt?.toMillis?.() ?? null,
    comments: Array.isArray(data.comments) ? data.comments.length : 0,
    worklogs: Array.isArray(data.worklogs) ? data.worklogs.length : 0,
  }
}

/** Borra lo que lleva más de 30 días en la papelera; devuelve cuántas. */
export async function purgeOldTrash(db: Firestore, uid: string, now = Date.now()): Promise<number> {
  const limit = Timestamp.fromMillis(now - TRASH_DAYS * 24 * 60 * 60 * 1000)
  const old = await getDocs(
    query(collection(db, 'users', uid, 'trash'), where('deletedAt', '<', limit)),
  )
  await commitInBatches(
    db,
    old.docs.map((d) => ({ kind: 'delete' as const, ref: d.ref })),
  )
  return old.size
}

export function deleteFromTrash(db: Firestore, uid: string, id: string): Promise<void> {
  return deleteDoc(doc(db, 'users', uid, 'trash', id))
}

/**
 * Restaura una tarea: la recrea con su id y su clave, con sus horas (con sus fechas) y sus
 * comentarios (con la fecha de hoy, que es lo que admiten las reglas). Sus vínculos se vuelven a
 * poner en las tareas que siguen existiendo; si su padre ya no existe, queda suelta. Devuelve la
 * clave.
 */
export async function restoreFromTrash(db: Firestore, uid: string, id: string): Promise<string> {
  const trashRef = doc(db, 'users', uid, 'trash', id)
  const snap = await getDoc(trashRef)
  if (!snap.exists()) throw new Error('not-in-trash')
  const data = snap.data()
  const task = { ...(data.task as Record<string, unknown>) }
  const tasks = tasksCollection(db, uid)
  const taskRef = doc(tasks, id)
  if ((await getDoc(taskRef)).exists()) throw new Error('task-exists')

  // Vínculos y padre: solo con las tareas que existen.
  const links = ((task.links ?? []) as TaskLink[]).filter((l) => l.taskId !== id)
  const others = await Promise.all(
    [...new Set(links.map((l) => l.taskId))].map((otherId) => getDoc(doc(tasks, otherId))),
  )
  const alive = new Set(others.filter((o) => o.exists()).map((o) => o.id))
  const parentId = task.parentId as string | null
  const parentAlive = parentId ? (await getDoc(doc(tasks, parentId))).exists() : false

  // La tarea va sola primero: las reglas comprueban la padre y las horas no dependen de nada.
  const first = writeBatch(db)
  first.set(taskRef, {
    ...task,
    links: links.filter((l) => alive.has(l.taskId)),
    parentId: parentAlive ? parentId : null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  await first.commit()

  const ops: Op[] = []
  for (const link of links.filter((l) => alive.has(l.taskId)))
    ops.push({
      kind: 'update',
      ref: doc(tasks, link.taskId),
      data: { links: arrayUnion(inverseLink(link, id)), updatedAt: serverTimestamp() },
    })
  for (const w of (data.worklogs ?? []) as Record<string, unknown>[]) {
    const { id: worklogId, ...fields } = w
    ops.push({
      kind: 'set',
      ref: doc(db, 'users', uid, 'worklogs', String(worklogId)),
      data: fields,
    })
  }
  for (const c of (data.comments ?? []) as Record<string, unknown>[])
    ops.push({
      kind: 'set',
      ref: doc(collection(taskRef, 'comments'), String(c.id)),
      data: { body: c.body, createdAt: serverTimestamp(), editedAt: null },
    })
  ops.push({ kind: 'delete', ref: trashRef })
  await commitInBatches(db, ops)
  return String(task.key ?? '')
}
