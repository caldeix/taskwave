import {
  arrayRemove,
  arrayUnion,
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
import { activityChanges, type ActivityChange } from '@/domain/activity'
import { inverseLink } from '@/domain/links'
import type { Task, TaskLink } from '@/domain/task'
import { tasksCollection } from './taskQueries'

/**
 * Apunta la actividad (step-22, D-42) en el mismo lote o transacción que el cambio, con la hora
 * del servidor (las reglas lo exigen).
 */
function writeActivity(
  writer: { set: (ref: DocumentReference, data: Record<string, unknown>) => unknown },
  taskRef: DocumentReference,
  changes: ActivityChange[],
): void {
  for (const change of changes)
    writer.set(doc(collection(taskRef, 'activity')), { ...change, at: serverTimestamp() })
}

/** Valores de antes de un cambio, para la actividad. */
export type TaskBefore = Partial<
  Pick<
    Task,
    'status' | 'startDate' | 'endDate' | 'estimateMin' | 'priority' | 'projectId' | 'title'
  >
>

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
    // Al duplicar, `from` es la clave de la original (step-24).
    writeActivity(tx, taskRef, [{ field: 'created', from: input.copyOf ?? null, to: newKey }])
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
  before?: TaskBefore,
): Promise<void> {
  const ref = doc(tasksCollection(db, uid), taskId)
  const batch = writeBatch(db)
  batch.update(ref, {
    startDate: dates.startDate,
    endDate: dates.endDate,
    updatedAt: serverTimestamp(),
  })
  if (before) writeActivity(batch, ref, activityChanges(before, dates))
  await batch.commit()
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
  before?: TaskBefore,
): Promise<void> {
  const data: Record<string, unknown> = { status: patch.status, updatedAt: serverTimestamp() }
  if (patch.resolvedAt === 'now') data.resolvedAt = serverTimestamp()
  else if (patch.resolvedAt === null) data.resolvedAt = null
  if (patch.startDate !== undefined) data.startDate = patch.startDate
  if (patch.endDate !== undefined) data.endDate = patch.endDate
  const ref = doc(tasksCollection(db, uid), taskId)
  const batch = writeBatch(db)
  batch.update(ref, data)
  if (before) {
    const { status, startDate, endDate } = data
    const tracked: Record<string, unknown> = { status }
    if ('startDate' in data) tracked.startDate = startDate
    if ('endDate' in data) tracked.endDate = endDate
    writeActivity(batch, ref, activityChanges(before, tracked))
  }
  await batch.commit()
}

/** Campos que se editan directamente desde la vista de tarea (step-14). */
export type EditableTaskFields = Partial<{
  title: string
  description: string
  priority: string
  estimateMin: number | null
  weblinks: { url: string; title: string }[]
  tagIds: string[]
}>

/**
 * Guarda cambios de campos sueltos con `updatedAt` del servidor (autoguardado, D-46). Con
 * `before`, apunta en la actividad los campos vigilados que cambian (título, prioridad, estimado).
 */
export async function updateTaskFields(
  db: Firestore,
  uid: string,
  taskId: string,
  fields: EditableTaskFields,
  before?: TaskBefore,
): Promise<void> {
  const ref = doc(tasksCollection(db, uid), taskId)
  const batch = writeBatch(db)
  batch.update(ref, { ...fields, updatedAt: serverTimestamp() })
  if (before) writeActivity(batch, ref, activityChanges(before, fields))
  await batch.commit()
}

/**
 * Mueve una tarea a otro proyecto (o a la bandeja). Como en Jira, cambia su clave (D-12): la
 * nueva sale del contador del destino en una transacción. Después se actualiza el proyecto de
 * sus registros de horas (para las estadísticas por proyecto). Devuelve la nueva clave.
 */
export async function moveTaskToProject(
  db: Firestore,
  uid: string,
  task: Pick<Task, 'id' | 'projectId'>,
  targetProjectId: string | null,
): Promise<string | null> {
  if (task.projectId === targetProjectId) return null
  const taskRef = doc(tasksCollection(db, uid), task.id)
  const counterRef = targetProjectId
    ? doc(db, 'users', uid, 'projects', targetProjectId)
    : doc(db, 'users', uid)
  const field = targetProjectId ? 'taskCounter' : 'inboxCounter'

  const newKey = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef)
    if (!snap.exists()) throw new Error('project-not-found')
    const data = snap.data()
    const next = Number(data[field] ?? 0) + 1
    const key = taskKey(targetProjectId ? String(data.key) : null, next)
    tx.update(counterRef, { [field]: next })
    tx.update(taskRef, { projectId: targetProjectId, key, updatedAt: serverTimestamp() })
    writeActivity(tx, taskRef, [{ field: 'projectId', from: task.projectId, to: targetProjectId }])
    return key
  })

  const worklogs = await getDocs(
    query(collection(db, 'users', uid, 'worklogs'), where('taskId', '==', task.id)),
  )
  await commitInBatches(
    db,
    worklogs.docs.map((d) => ({
      kind: 'update' as const,
      ref: d.ref,
      data: { projectId: targetProjectId },
    })),
  )
  return newKey
}

export interface DeleteSummary {
  comments: number
  activity: number
  worklogs: number
  subtasksDetached: number
  linksCleaned: number
  timerCleared: boolean
}

export type Op =
  | { kind: 'delete'; ref: DocumentReference }
  | { kind: 'update'; ref: DocumentReference; data: Record<string, unknown> }

/** Firestore admite como mucho 500 escrituras por lote; se deja margen. */
const BATCH_SIZE = 450

export async function commitInBatches(db: Firestore, ops: Op[]): Promise<void> {
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

/**
 * Vincula dos tareas (step-16, D-41). El vínculo se guarda en las dos, cada una con su tipo
 * (A bloquea a B → B bloqueada por A), en un lote: o se escriben las dos o ninguna.
 * `arrayUnion` no repite un vínculo que ya esté y no necesita leer antes, así que funciona sin
 * conexión y no pisa vínculos añadidos a la vez desde otra pestaña.
 */
export async function linkTasks(
  db: Firestore,
  uid: string,
  taskId: string,
  link: TaskLink,
): Promise<void> {
  const tasks = tasksCollection(db, uid)
  const batch = writeBatch(db)
  batch.update(doc(tasks, taskId), {
    links: arrayUnion({ type: link.type, taskId: link.taskId }),
    updatedAt: serverTimestamp(),
  })
  batch.update(doc(tasks, link.taskId), {
    links: arrayUnion(inverseLink(link, taskId)),
    updatedAt: serverTimestamp(),
  })
  await batch.commit()
}

/**
 * Quita un vínculo de las dos tareas. Si la otra ya no existe (borrada desde otro sitio), solo
 * se limpia esta.
 */
export async function unlinkTasks(
  db: Firestore,
  uid: string,
  taskId: string,
  link: TaskLink,
): Promise<void> {
  const tasks = tasksCollection(db, uid)
  const self = {
    links: arrayRemove({ type: link.type, taskId: link.taskId }),
    updatedAt: serverTimestamp(),
  }
  const otherRef = doc(tasks, link.taskId)
  const other = await getDoc(otherRef)
  const batch = writeBatch(db)
  batch.update(doc(tasks, taskId), self)
  if (other.exists())
    batch.update(otherRef, {
      links: arrayRemove(inverseLink(link, taskId)),
      updatedAt: serverTimestamp(),
    })
  await batch.commit()
}

/**
 * Pone o quita la tarea padre (subtareas de un nivel, D-41). Las reglas comprueban que la padre
 * exista y no sea subtarea; que la hija no tenga subtareas lo comprueba la app antes.
 */
export async function setTaskParent(
  db: Firestore,
  uid: string,
  taskId: string,
  parentId: string | null,
): Promise<void> {
  await updateDoc(doc(tasksCollection(db, uid), taskId), {
    parentId,
    updatedAt: serverTimestamp(),
  })
}
