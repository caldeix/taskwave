import {
  collection,
  deleteDoc,
  doc,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type CollectionReference,
  type Firestore,
  type Query,
} from 'firebase/firestore'
import { normalizeCommentBody } from '@/domain/comments'

/**
 * Comentarios de una tarea (step-18). Las reglas obligan a que `createdAt` y `editedAt` sean la
 * hora del servidor, así que las fechas no dependen del reloj del equipo.
 */

export function commentsCollection(
  db: Firestore,
  uid: string,
  taskId: string,
): CollectionReference {
  return collection(db, 'users', uid, 'tasks', taskId, 'comments')
}

/** Los comentarios más recientes primero, con límite (se amplía con «Ver más»). */
export function commentsQuery(db: Firestore, uid: string, taskId: string, max: number): Query {
  return query(commentsCollection(db, uid, taskId), orderBy('createdAt', 'desc'), limit(max))
}

/** Añade un comentario. El id se genera en el cliente, así que funciona sin conexión. */
export async function addComment(
  db: Firestore,
  uid: string,
  taskId: string,
  body: string,
): Promise<string> {
  const ref = doc(commentsCollection(db, uid, taskId))
  await setDoc(ref, {
    body: normalizeCommentBody(body),
    createdAt: serverTimestamp(),
    editedAt: null,
  })
  return ref.id
}

/** Cambia el texto y marca el comentario como editado (con la hora del servidor). */
export async function editComment(
  db: Firestore,
  uid: string,
  taskId: string,
  commentId: string,
  body: string,
): Promise<void> {
  await updateDoc(doc(commentsCollection(db, uid, taskId), commentId), {
    body: normalizeCommentBody(body),
    editedAt: serverTimestamp(),
  })
}

export async function deleteComment(
  db: Firestore,
  uid: string,
  taskId: string,
  commentId: string,
): Promise<void> {
  await deleteDoc(doc(commentsCollection(db, uid, taskId), commentId))
}
