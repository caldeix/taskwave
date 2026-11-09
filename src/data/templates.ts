import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  type CollectionReference,
  type Firestore,
  type Query,
} from 'firebase/firestore'
import type { TaskTemplate } from '@/domain/templates'

/** Plantillas de tarea (v1.1.0, D-10) en `users/{uid}/templates`. */
export function templatesCollection(db: Firestore, uid: string): CollectionReference {
  return collection(db, 'users', uid, 'templates')
}

export function templatesQuery(db: Firestore, uid: string): Query {
  return query(templatesCollection(db, uid), orderBy('name'))
}

export async function saveTemplate(
  db: Firestore,
  uid: string,
  template: Omit<TaskTemplate, 'id'>,
): Promise<string> {
  const ref = await addDoc(templatesCollection(db, uid), {
    ...template,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export function deleteTemplate(db: Firestore, uid: string, id: string): Promise<void> {
  return deleteDoc(doc(templatesCollection(db, uid), id))
}
