import {
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type CollectionReference,
  type Firestore,
} from 'firebase/firestore'
import type { ProjectColor } from '@/domain/projects'
import { normalizeTagName } from '@/domain/tags'
import { commitInBatches, type Op } from './taskWrites'
import { tasksCollection } from './taskQueries'

/**
 * Catálogo de tags (step-17, D-40). Las tareas guardan solo el id del tag, así que renombrarlo
 * o cambiarle el color no toca ninguna tarea. Reciben la instancia de Firestore para poder
 * probarlas contra el emulador (tests/data).
 */

export function tagsCollection(db: Firestore, uid: string): CollectionReference {
  return collection(db, 'users', uid, 'tags')
}

/** Crea un tag. El id se genera en el cliente, así que funciona sin conexión. */
export async function createTag(
  db: Firestore,
  uid: string,
  tag: { name: string; color: ProjectColor },
): Promise<string> {
  const ref = doc(tagsCollection(db, uid))
  await setDoc(ref, { name: normalizeTagName(tag.name), color: tag.color })
  return ref.id
}

/** Renombra un tag o le cambia el color. */
export async function updateTag(
  db: Firestore,
  uid: string,
  tagId: string,
  changes: Partial<{ name: string; color: ProjectColor }>,
): Promise<void> {
  const data: Record<string, unknown> = { ...changes }
  if (changes.name !== undefined) data.name = normalizeTagName(changes.name)
  await updateDoc(doc(tagsCollection(db, uid), tagId), data)
}

/** Cuántas tareas llevan el tag (para avisar antes de borrarlo). Cuesta 1 lectura cada 1000. */
export async function countTagTasks(db: Firestore, uid: string, tagId: string): Promise<number> {
  const snap = await getCountFromServer(
    query(tasksCollection(db, uid), where('tagIds', 'array-contains', tagId)),
  )
  return snap.data().count
}

/**
 * Borra un tag: primero lo quita de todas sus tareas (en lotes) y luego borra el tag, para no
 * dejar ids huérfanos. Devuelve en cuántas tareas estaba.
 */
export async function deleteTag(db: Firestore, uid: string, tagId: string): Promise<number> {
  const tasks = await getDocs(
    query(tasksCollection(db, uid), where('tagIds', 'array-contains', tagId)),
  )
  const ops: Op[] = tasks.docs.map((d) => ({
    kind: 'update',
    ref: d.ref,
    data: { tagIds: arrayRemove(tagId), updatedAt: serverTimestamp() },
  }))
  await commitInBatches(db, ops)
  await deleteDoc(doc(tagsCollection(db, uid), tagId))
  return tasks.size
}
