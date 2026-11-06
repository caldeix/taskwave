import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import {
  Timestamp,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore'
import {
  addComment,
  commentsCollection,
  commentsQuery,
  deleteComment,
  editComment,
} from '@/data/comments'
import { U, as, resetAndSeed, setupEnv, validTask } from '../rules/helpers'

/** Comentarios (step-18) contra el emulador, con las reglas activas. */

let env: RulesTestEnvironment

async function readComment(id: string): Promise<Record<string, unknown> | undefined> {
  let data: Record<string, unknown> | undefined
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore
    data = (await getDoc(doc(commentsCollection(db, U.active, 'T'), id))).data()
  })
  return data
}

beforeAll(async () => {
  env = await setupEnv()
})
afterAll(async () => {
  await env.cleanup()
})
beforeEach(async () => {
  await resetAndSeed(env)
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore
    await setDoc(doc(db, 'users', U.active, 'tasks', 'T'), validTask())
  })
})

describe('addComment, editComment y deleteComment', () => {
  it('crea con la hora del servidor y sin marca de editado', async () => {
    const before = Date.now()
    const id = await addComment(as(env, U.active), U.active, 'T', 'Hola **mundo**\n\n')
    const data = await readComment(id)
    expect(data?.body).toBe('Hola **mundo**')
    expect(data?.editedAt).toBeNull()
    const created = (data?.createdAt as Timestamp).toMillis()
    expect(created).toBeGreaterThanOrEqual(before - 5000)
    expect(created).toBeLessThanOrEqual(Date.now() + 5000)
  })

  it('editar cambia el texto, pone «editado» y conserva la fecha de creación', async () => {
    const db = as(env, U.active)
    const id = await addComment(db, U.active, 'T', 'Primera versión')
    const created = (await readComment(id))?.createdAt as Timestamp
    await new Promise((r) => setTimeout(r, 20))
    await editComment(db, U.active, 'T', id, 'Segunda versión')
    const data = await readComment(id)
    expect(data?.body).toBe('Segunda versión')
    expect((data?.createdAt as Timestamp).isEqual(created)).toBe(true)
    expect((data?.editedAt as Timestamp).toMillis()).toBeGreaterThan(created.toMillis())
  })

  it('las reglas no dejan inventar fechas, cambiar la de creación ni guardar vacíos', async () => {
    const db = as(env, U.active)
    const ref = doc(commentsCollection(db, U.active, 'T'), 'x')
    await expect(
      setDoc(ref, { body: 'a', createdAt: Timestamp.fromMillis(0), editedAt: null }),
    ).rejects.toThrow()
    await expect(addComment(db, U.active, 'T', '')).rejects.toThrow()
    const id = await addComment(db, U.active, 'T', 'a')
    await expect(
      updateDoc(doc(commentsCollection(db, U.active, 'T'), id), {
        createdAt: Timestamp.fromMillis(0),
      }),
    ).rejects.toThrow()
    await expect(editComment(db, U.active, 'T', id, 'x'.repeat(10001))).rejects.toThrow()
  })

  it('borra el comentario', async () => {
    const db = as(env, U.active)
    const id = await addComment(db, U.active, 'T', 'Me sobra')
    await deleteComment(db, U.active, 'T', id)
    expect(await readComment(id)).toBeUndefined()
  })

  it('otro usuario no puede comentar, leer ni borrar', async () => {
    const id = await addComment(as(env, U.active), U.active, 'T', 'Privado')
    const intruder = as(env, U.other)
    await expect(addComment(intruder, U.active, 'T', 'hola')).rejects.toThrow()
    await expect(getDocs(commentsQuery(intruder, U.active, 'T', 10))).rejects.toThrow()
    await expect(deleteComment(intruder, U.active, 'T', id)).rejects.toThrow()
  })
})

describe('commentsQuery', () => {
  it('devuelve los más recientes primero, con límite', async () => {
    const db = as(env, U.active)
    for (const body of ['uno', 'dos', 'tres']) {
      await addComment(db, U.active, 'T', body)
      await new Promise((r) => setTimeout(r, 15))
    }
    const snap = await getDocs(commentsQuery(db, U.active, 'T', 2))
    expect(snap.docs.map((d) => d.data().body)).toEqual(['tres', 'dos'])
  })
})
