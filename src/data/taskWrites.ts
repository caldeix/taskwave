import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentReference,
  type Firestore,
} from 'firebase/firestore'
import { buildNewTask, removeLinksTo, taskKey, type NewTaskInput } from '@/domain/taskCreate'
import type { StatusPatch } from '@/domain/kanban'
import type { Task, TaskLink } from '@/domain/task'
import { tasksCollection } from './taskQueries'

/**
 * Altas y bajas de tareas (step-10). Reciben la instancia de Firestore para poder probarlas
 * contra el emulador con las reglas activas (tests/data).
 */

/**
 * Crea una tarea con su clave (`EST-12`, D-12). El contador del proyecto (o `inboxCounter` del
 * perfil para la bandeja) se incrementa en la misma transacción, así que dos altas a la vez
 * nunca repiten clave. Necesita conexión (las transacciones no funcionan sin red).
 */
export async function createTask(
  db: Firestore,
  uid: string,
  input: NewTaskInput,
): Promise<{ id: string; key: string }> {
  const taskRef = doc(tasksCollection(db, uid))
  const counterRef = input.projectId
    ? doc(db, 'users', uid, 'projects', input.projectId)
    : doc(db, 'users', uid)
  const field = input.projectId ? 'taskCounter' : 'inboxCounter'

  const key = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef)
    if (!snap.exists()) throw new Error('project-not-found')
    const data = snap.data()
    const next = Number(data[field] ?? 0) + 1
    const newKey = taskKey(input.projectId ? String(data.key) : null, next)
    tx.update(counterRef, { [field]: next })
    tx.set(taskRef, buildNewTask(input, newKey, serverTimestamp()))
    return newKey
  })
  return { id: taskRef.id, key }
}

/**
 * Cambia las fechas de una tarea (arrastrar en el calendario, step-11). Las reglas rechazan
 * fechas mal formadas o un fin anterior al inicio.
 */
export async function updateTaskDates(
  db: Firestore,
  uid: string,
  taskId: string,
  dates: { startDate: string | null; endDate: string | null },
): Promise<void> {
  await updateDoc(doc(tasksCollection(db, uid), taskId), {
    startDate: dates.startDate,
    endDate: dates.endDate,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Cambia el estado de una tarea con sus automatismos (kanban, step-12, D-17): la hora de cierre
 * la pone el servidor y las fechas se ajustan según `statusChangePatch`.
 */
export async function updateTaskStatus(
  db: Firestore,
  uid: string,
  taskId: string,
  patch: StatusPatch,
): Promise<void> {
  const data: Record<string, unknown> = { status: patch.status, updatedAt: serverTimestamp() }
  if (patch.resolvedAt === 'now') data.resolvedAt = serverTimestamp()
  else if (patch.resolvedAt === null) data.resolvedAt = null
  if (patch.startDate !== undefined) data.startDate = patch.startDate
  if (patch.endDate !== undefined) data.endDate = patch.endDate
  await updateDoc(doc(tasksCollection(db, uid), taskId), data)
}

export interface DeleteSummary {
  comments: number
  activity: number
  worklogs: number
  subtasksDetached: number
  linksCleaned: number
  timerCleared: boolean
}

type Op =
  | { kind: 'delete'; ref: DocumentReference }
  | { kind: 'update'; ref: DocumentReference; data: Record<string, unknown> }

/** Firestore admite como mucho 500 escrituras por lote; se deja margen. */
const BATCH_SIZE = 450

async function commitInBatches(db: Firestore, ops: Op[]): Promise<void> {
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const batch = writeBatch(db)
    for (const op of ops.slice(i, i + BATCH_SIZE)) {
      if (op.kind === 'delete') batch.delete(op.ref)
      else batch.update(op.ref, op.data)
    }
    await batch.commit()
  }
}

/**
 * Borra una tarea de forma definitiva (D-13): sus comentarios, su actividad y sus registros de
 * horas; quita sus vínculos de las otras tareas; sus subtareas quedan sueltas; y si el
 * cronómetro estaba en ella, se para. La tarea se borra en el último lote, al final.
 */
export async function deleteTask(db: Firestore, uid: string, task: Task): Promise<DeleteSummary> {
  const tasks = tasksCollection(db, uid)
  const taskRef = doc(tasks, task.id)
  const profileRef = doc(db, 'users', uid)

  const [comments, activity, worklogs, subtasks, profile] = await Promise.all([
    getDocs(collection(taskRef, 'comments')),
    getDocs(collection(taskRef, 'activity')),
    getDocs(query(collection(db, 'users', uid, 'worklogs'), where('taskId', '==', task.id))),
    getDocs(query(tasks, where('parentId', '==', task.id))),
    getDoc(profileRef),
  ])

  const linkedIds = [...new Set(task.links.map((link) => link.taskId))].filter(
    (id) => id !== task.id,
  )
  const linked = await Promise.all(linkedIds.map((id) => getDoc(doc(tasks, id))))

  const ops: Op[] = []
  for (const d of [...comments.docs, ...activity.docs, ...worklogs.docs])
    ops.push({ kind: 'delete', ref: d.ref })
  for (const d of subtasks.docs)
    ops.push({ kind: 'update', ref: d.ref, data: { parentId: null, updatedAt: serverTimestamp() } })

  let linksCleaned = 0
  for (const snap of linked) {
    if (!snap.exists()) continue
    const links = (snap.data().links ?? []) as TaskLink[]
    const cleaned = removeLinksTo(links, task.id)
    if (cleaned.length !== links.length) {
      linksCleaned++
      ops.push({
        kind: 'update',
        ref: snap.ref,
        data: { links: cleaned, updatedAt: serverTimestamp() },
      })
    }
  }

  const timer = profile.data()?.activeTimer as { taskId?: string } | null | undefined
  const timerCleared = timer?.taskId === task.id
  if (timerCleared) ops.push({ kind: 'update', ref: profileRef, data: { activeTimer: null } })

  ops.push({ kind: 'delete', ref: taskRef })
  await commitInBatches(db, ops)

  return {
    comments: comments.size,
    activity: activity.size,
    worklogs: worklogs.size,
    subtasksDetached: subtasks.size,
    linksCleaned,
    timerCleared,
  }
}
