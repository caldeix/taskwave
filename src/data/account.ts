import {
  collection,
  doc,
  getDocs,
  writeBatch,
  type DocumentReference,
  type Firestore,
} from 'firebase/firestore'

/**
 * Baja de la cuenta (step-25, P-9): borra todos los datos del usuario. El perfil se borra el
 * último, porque las reglas de los datos exigen que la cuenta siga activa; después la app borra
 * la cuenta de Auth (`deleteUser`).
 */

const BATCH_SIZE = 450
/** Subcolecciones que se leen a la vez (comentarios y actividad de cada tarea). */
const PARALLEL = 10

export interface DeletedCounts {
  tasks: number
  comments: number
  activity: number
  worklogs: number
  projects: number
  tags: number
}

async function deleteAll(db: Firestore, refs: DocumentReference[]): Promise<void> {
  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db)
    for (const ref of refs.slice(i, i + BATCH_SIZE)) batch.delete(ref)
    await batch.commit()
  }
}

/** Borra todos los datos del usuario y su perfil. Devuelve cuántos documentos había. */
export async function deleteAccountData(db: Firestore, uid: string): Promise<DeletedCounts> {
  const user = doc(db, 'users', uid)
  const [tasks, worklogs, projects, tags] = await Promise.all(
    ['tasks', 'worklogs', 'projects', 'tags'].map((name) => getDocs(collection(user, name))),
  )

  const children: DocumentReference[] = []
  let comments = 0
  let activity = 0
  const taskRefs = tasks!.docs.map((d) => d.ref)
  for (let i = 0; i < taskRefs.length; i += PARALLEL) {
    const snaps = await Promise.all(
      taskRefs
        .slice(i, i + PARALLEL)
        .flatMap((ref) => [
          getDocs(collection(ref, 'comments')),
          getDocs(collection(ref, 'activity')),
        ]),
    )
    snaps.forEach((snap, j) => {
      if (j % 2 === 0) comments += snap.size
      else activity += snap.size
      children.push(...snap.docs.map((d) => d.ref))
    })
  }

  // Primero lo que cuelga de las tareas, luego el resto y el perfil al final.
  await deleteAll(db, children)
  await deleteAll(db, [
    ...taskRefs,
    ...worklogs!.docs.map((d) => d.ref),
    ...projects!.docs.map((d) => d.ref),
    ...tags!.docs.map((d) => d.ref),
  ])
  await deleteAll(db, [user])

  return {
    tasks: taskRefs.length,
    comments,
    activity,
    worklogs: worklogs!.size,
    projects: projects!.size,
    tags: tags!.size,
  }
}
