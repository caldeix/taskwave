import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, getDocs, setDoc, writeBatch, type Firestore } from 'firebase/firestore'
import { countTagTasks, createTag, deleteTag, tagsCollection, updateTag } from '@/data/tagWrites'
import { updateTaskFields } from '@/data/taskWrites'
import { U, as, resetAndSeed, setupEnv, validTask } from '../rules/helpers'

/** Catálogo de tags (step-17) contra el emulador, con las reglas activas. */

let env: RulesTestEnvironment

async function admin<T>(fn: (db: Firestore) => Promise<T>): Promise<T> {
  let result!: T
  await env.withSecurityRulesDisabled(async (ctx) => {
    result = await fn(ctx.firestore() as unknown as Firestore)
  })
  return result
}

const tagIdsOf = (id: string) =>
  admin(async (a) => (await getDoc(doc(a, 'users', U.active, 'tasks', id))).data()?.tagIds)

beforeAll(async () => {
  env = await setupEnv()
})
afterAll(async () => {
  await env.cleanup()
})
beforeEach(async () => {
  await resetAndSeed(env)
  await admin(async (a) => {
    const batch = writeBatch(a)
    batch.set(doc(a, 'users', U.active, 'tags', 'uni'), { name: 'universidad', color: 'blue' })
    batch.set(doc(a, 'users', U.active, 'tags', 'urg'), { name: 'urgente', color: 'coral' })
    const task = (id: string, tagIds: string[]) =>
      batch.set(doc(a, 'users', U.active, 'tasks', id), {
        ...validTask(),
        key: `EST-${id}`,
        tagIds,
      })
    task('1', ['uni', 'urg'])
    task('2', ['uni'])
    task('3', [])
    await batch.commit()
  })
})

describe('createTag y updateTag (D-40)', () => {
  it('crea un tag con el nombre limpio y lo renombra o le cambia el color', async () => {
    const db = as(env, U.active)
    const id = await createTag(db, U.active, { name: '  Lectura   rápida ', color: 'violet' })
    const read = async () =>
      (await getDoc(doc(tagsCollection(db, U.active), id))).data() as Record<string, unknown>
    expect(await read()).toEqual({ name: 'Lectura rápida', color: 'violet' })
    await updateTag(db, U.active, id, { name: ' Lectura ' })
    await updateTag(db, U.active, id, { color: 'mustard' })
    expect(await read()).toEqual({ name: 'Lectura', color: 'mustard' })
  })

  it('las reglas rechazan nombres vacíos o largos, colores fuera del DS y campos de más', async () => {
    const db = as(env, U.active)
    await expect(createTag(db, U.active, { name: '   ', color: 'blue' })).rejects.toThrow()
    await expect(createTag(db, U.active, { name: 'x'.repeat(41), color: 'blue' })).rejects.toThrow()
    await expect(
      createTag(db, U.active, { name: 'rojo', color: 'red' as unknown as 'blue' }),
    ).rejects.toThrow()
    await expect(
      setDoc(doc(tagsCollection(db, U.active), 'x'), { name: 'a', color: 'blue', extra: 1 }),
    ).rejects.toThrow()
  })

  it('otro usuario no puede crear ni leer mis tags', async () => {
    const intruder = as(env, U.other)
    await expect(createTag(intruder, U.active, { name: 'a', color: 'blue' })).rejects.toThrow()
    await expect(getDocs(tagsCollection(intruder, U.active))).rejects.toThrow()
  })
})

describe('tags de una tarea', () => {
  it('se guardan como ids en la tarea, hasta 20', async () => {
    const db = as(env, U.active)
    await updateTaskFields(db, U.active, '3', { tagIds: ['urg'] })
    expect(await tagIdsOf('3')).toEqual(['urg'])
    const many = Array.from({ length: 21 }, (_, i) => `t${i}`)
    await expect(updateTaskFields(db, U.active, '3', { tagIds: many })).rejects.toThrow()
  })
})

describe('countTagTasks y deleteTag', () => {
  it('cuenta las tareas que llevan el tag', async () => {
    const db = as(env, U.active)
    expect(await countTagTasks(db, U.active, 'uni')).toBe(2)
    expect(await countTagTasks(db, U.active, 'urg')).toBe(1)
  })

  it('al borrar un tag, desaparece de todas sus tareas y no toca los demás', async () => {
    const db = as(env, U.active)
    expect(await deleteTag(db, U.active, 'uni')).toBe(2)
    expect(await tagIdsOf('1')).toEqual(['urg'])
    expect(await tagIdsOf('2')).toEqual([])
    const tag = await admin((a) => getDoc(doc(a, 'users', U.active, 'tags', 'uni')))
    expect(tag.exists()).toBe(false)
  })
})
