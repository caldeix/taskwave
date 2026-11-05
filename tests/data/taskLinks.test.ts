import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import {
  Timestamp,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { subtasksQuery, tasksByIdsQueries } from '@/data/taskQueries'
import {
  createTask,
  linkTasks,
  setTaskParent,
  unlinkTasks,
  updateTaskFields,
} from '@/data/taskWrites'
import type { NewTaskInput } from '@/domain/taskCreate'
import { U, as, resetAndSeed, setupEnv, validTask } from '../rules/helpers'

/** Vínculos y subtareas (step-16) contra el emulador, con las reglas activas. */

let env: RulesTestEnvironment

async function admin(write: (db: Firestore) => Promise<void>): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => write(ctx.firestore() as unknown as Firestore))
}

async function readTask(id: string): Promise<Record<string, unknown> | undefined> {
  let data: Record<string, unknown> | undefined
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore
    data = (await getDoc(doc(db, 'users', U.active, 'tasks', id))).data()
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
  await admin(async (db) => {
    await setDoc(doc(db, 'users', U.active, 'projects', 'p1'), {
      name: 'Estudio',
      key: 'EST',
      color: 'blue',
      icon: 'book-open',
      order: 0,
      archived: false,
      taskCounter: 10,
      createdAt: Timestamp.now(),
    })
    const task = (id: string, key: string, extra: Record<string, unknown> = {}) =>
      setDoc(doc(db, 'users', U.active, 'tasks', id), { ...validTask(), key, ...extra })
    await task('A', 'EST-1')
    await task('B', 'EST-2')
    await task('P', 'EST-3')
    await task('S', 'EST-4', { parentId: 'P' })
  })
})

describe('linkTasks y unlinkTasks (D-41)', () => {
  it('guarda el vínculo en las dos tareas con su tipo, sin repetirlo', async () => {
    const db = as(env, U.active)
    await linkTasks(db, U.active, 'A', { type: 'blocks', taskId: 'B' })
    await linkTasks(db, U.active, 'A', { type: 'blocks', taskId: 'B' })
    await linkTasks(db, U.active, 'A', { type: 'relates', taskId: 'B' })
    expect((await readTask('A'))?.links).toEqual([
      { type: 'blocks', taskId: 'B' },
      { type: 'relates', taskId: 'B' },
    ])
    expect((await readTask('B'))?.links).toEqual([
      { type: 'blocked_by', taskId: 'A' },
      { type: 'relates', taskId: 'A' },
    ])
  })

  it('quitar un vínculo lo quita de las dos y deja los demás', async () => {
    const db = as(env, U.active)
    await linkTasks(db, U.active, 'A', { type: 'causes', taskId: 'B' })
    await linkTasks(db, U.active, 'A', { type: 'relates', taskId: 'B' })
    await unlinkTasks(db, U.active, 'B', { type: 'caused_by', taskId: 'A' })
    expect((await readTask('A'))?.links).toEqual([{ type: 'relates', taskId: 'B' }])
    expect((await readTask('B'))?.links).toEqual([{ type: 'relates', taskId: 'A' }])
  })

  it('si la otra tarea ya no existe, se limpia solo esta', async () => {
    const db = as(env, U.active)
    await linkTasks(db, U.active, 'A', { type: 'relates', taskId: 'B' })
    await admin((a) => deleteDoc(doc(a, 'users', U.active, 'tasks', 'B')))
    await unlinkTasks(db, U.active, 'A', { type: 'relates', taskId: 'B' })
    expect((await readTask('A'))?.links).toEqual([])
  })

  it('otro usuario no puede vincular mis tareas', async () => {
    await expect(
      linkTasks(as(env, U.other), U.active, 'A', { type: 'relates', taskId: 'B' }),
    ).rejects.toThrow()
    expect((await readTask('A'))?.links).toEqual([])
  })
})

describe('subtareas de un nivel (D-41)', () => {
  it('pone y quita la padre', async () => {
    const db = as(env, U.active)
    await setTaskParent(db, U.active, 'A', 'P')
    expect((await readTask('A'))?.parentId).toBe('P')
    await setTaskParent(db, U.active, 'A', null)
    expect((await readTask('A'))?.parentId).toBeNull()
  })

  it('las reglas rechazan una padre que es subtarea, que no existe o la propia tarea', async () => {
    const db = as(env, U.active)
    await expect(setTaskParent(db, U.active, 'A', 'S')).rejects.toThrow()
    await expect(setTaskParent(db, U.active, 'A', 'no-existe')).rejects.toThrow()
    await expect(setTaskParent(db, U.active, 'A', 'A')).rejects.toThrow()
    expect((await readTask('A'))?.parentId).toBeNull()
  })

  it('una subtarea existente se puede seguir editando sin volver a comprobar la padre', async () => {
    // Datos antiguos: S apunta a P aunque P pasara a ser subtarea; editar S no debe fallar.
    await admin((a) =>
      setDoc(doc(a, 'users', U.active, 'tasks', 'P'), { parentId: 'A' }, { merge: true }),
    )
    await updateTaskFields(as(env, U.active), U.active, 'S', { title: 'Nuevo título' })
    expect((await readTask('S'))?.title).toBe('Nuevo título')
  })

  it('crea una subtarea con su padre, pero no debajo de otra subtarea', async () => {
    const db = as(env, U.active)
    const input: NewTaskInput = {
      title: 'Subtarea nueva',
      projectId: 'p1',
      startDate: null,
      endDate: null,
      priority: 'medium',
      parentId: 'P',
    }
    const { id, key } = await createTask(db, U.active, input)
    expect(key).toBe('EST-11')
    expect((await readTask(id))?.parentId).toBe('P')
    await expect(createTask(db, U.active, { ...input, parentId: 'S' })).rejects.toThrow()
  })
})

describe('consultas de tareas relacionadas', () => {
  it('subtasksQuery devuelve las hijas', async () => {
    const snap = await getDocs(subtasksQuery(as(env, U.active), U.active, 'P'))
    expect(snap.docs.map((d) => d.id)).toEqual(['S'])
  })

  it('tasksByIdsQueries trae las tareas pedidas en grupos de 30', async () => {
    await admin(async (a) => {
      const batch = writeBatch(a)
      for (let i = 0; i < 35; i++)
        batch.set(doc(a, 'users', U.active, 'tasks', `X${i}`), {
          ...validTask(),
          key: `EST-${100 + i}`,
        })
      await batch.commit()
    })
    const ids = [...Array.from({ length: 35 }, (_, i) => `X${i}`), 'A', 'A', 'no-existe']
    const queries = tasksByIdsQueries(as(env, U.active), U.active, ids)
    expect(queries).toHaveLength(2)
    const found = (await Promise.all(queries.map((q) => getDocs(q)))).flatMap((s) =>
      s.docs.map((d) => d.id),
    )
    expect(found).toHaveLength(36)
    expect(found).toContain('A')
  })

  it('otro usuario no puede leer mis tareas por id', async () => {
    const [q] = tasksByIdsQueries(as(env, U.other), U.active, ['A'])
    await expect(getDocs(q!)).rejects.toThrow()
  })
})
