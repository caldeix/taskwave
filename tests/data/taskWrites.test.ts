import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  type Firestore,
} from 'firebase/firestore'
import {
  createTask,
  deleteTask,
  moveTaskToProject,
  updateTaskDates,
  updateTaskFields,
  updateTaskStatus,
} from '@/data/taskWrites'
import { restoreFromTrash } from '@/data/trash'
import { taskFromData } from '@/domain/task'
import type { NewTaskInput } from '@/domain/taskCreate'
import {
  U,
  as,
  resetAndSeed,
  setupEnv,
  validComment,
  validTask,
  validWorklog,
} from '../rules/helpers'

let env: RulesTestEnvironment

const input = (extra: Partial<NewTaskInput> = {}): NewTaskInput => ({
  title: 'Tarea de prueba',
  projectId: 'p1',
  startDate: '2026-11-05',
  endDate: null,
  priority: 'medium',
  ...extra,
})

/** Escribe con las reglas desactivadas (preparar datos). */
async function admin(write: (db: Firestore) => Promise<void>): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => write(ctx.firestore() as unknown as Firestore))
}

async function readAsAdmin<T>(read: (db: Firestore) => Promise<T>): Promise<T> {
  let result!: T
  await env.withSecurityRulesDisabled(async (ctx) => {
    result = await read(ctx.firestore() as unknown as Firestore)
  })
  return result
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
      taskCounter: 0,
      createdAt: Timestamp.now(),
    })
  })
})

describe('createTask (D-12, D-15)', () => {
  it('numera las tareas del proyecto: EST-1, EST-2…', async () => {
    const db = as(env, U.active)
    const first = await createTask(db, U.active, input())
    const second = await createTask(db, U.active, input({ title: 'Otra' }))
    expect([first.key, second.key]).toEqual(['EST-1', 'EST-2'])

    const stored = await readAsAdmin((a) => getDoc(doc(a, 'users', U.active, 'tasks', first.id)))
    expect(stored.data()).toMatchObject({ key: 'EST-1', status: 'pending', spentMin: 0 })
    const project = await readAsAdmin((a) => getDoc(doc(a, 'users', U.active, 'projects', 'p1')))
    expect(project.data()?.taskCounter).toBe(2)
  })

  it('sin proyecto usa INB y el contador del perfil (D-11)', async () => {
    const db = as(env, U.active)
    const created = await createTask(db, U.active, input({ projectId: null }))
    expect(created.key).toBe('INB-1')
    const profile = await readAsAdmin((a) => getDoc(doc(a, 'users', U.active)))
    expect(profile.data()?.inboxCounter).toBe(1)
  })

  it('varias altas a la vez nunca repiten clave', async () => {
    const db = as(env, U.active)
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => createTask(db, U.active, input({ title: `T${i}` }))),
    )
    expect(results.map((r) => r.key).sort()).toEqual(['EST-1', 'EST-2', 'EST-3', 'EST-4', 'EST-5'])
  })

  it('falla con un proyecto que no existe y otro usuario no puede crear en mi proyecto', async () => {
    await expect(
      createTask(as(env, U.active), U.active, input({ projectId: 'no-existe' })),
    ).rejects.toThrow()
    await expect(createTask(as(env, U.other), U.active, input())).rejects.toThrow()
  })
})

describe('updateTaskDates (arrastrar en el calendario, D-21)', () => {
  it('cambia las fechas y rechaza un fin anterior al inicio', async () => {
    const db = as(env, U.active)
    const { id } = await createTask(db, U.active, input({ endDate: '2026-11-07' }))
    await updateTaskDates(db, U.active, id, { startDate: '2026-11-10', endDate: '2026-11-12' })
    const stored = await readAsAdmin((a) => getDoc(doc(a, 'users', U.active, 'tasks', id)))
    expect(stored.data()).toMatchObject({ startDate: '2026-11-10', endDate: '2026-11-12' })

    await expect(
      updateTaskDates(db, U.active, id, { startDate: '2026-11-10', endDate: '2026-11-01' }),
    ).rejects.toThrow()
    await expect(
      updateTaskDates(as(env, U.other), U.active, id, { startDate: '2026-12-01', endDate: null }),
    ).rejects.toThrow()
  })
})

describe('updateTaskStatus (kanban, D-17)', () => {
  it('al cerrar guarda la hora del servidor y la fecha fin; al reabrir la borra', async () => {
    const db = as(env, U.active)
    const { id } = await createTask(db, U.active, input({ startDate: '2026-11-01' }))
    const read = async () =>
      (await readAsAdmin((a) => getDoc(doc(a, 'users', U.active, 'tasks', id)))).data()!

    await updateTaskStatus(db, U.active, id, {
      status: 'done',
      resolvedAt: 'now',
      endDate: '2026-11-05',
    })
    const closed = await read()
    expect(closed.status).toBe('done')
    expect(closed.resolvedAt).toBeInstanceOf(Timestamp)
    expect(closed.endDate).toBe('2026-11-05')

    await updateTaskStatus(db, U.active, id, { status: 'in_progress', resolvedAt: null })
    const reopened = await read()
    expect(reopened).toMatchObject({ status: 'in_progress', resolvedAt: null })
  })

  it('las reglas rechazan estados inventados', async () => {
    const db = as(env, U.active)
    const { id } = await createTask(db, U.active, input())
    await expect(
      updateTaskStatus(db, U.active, id, { status: 'archivada' as never }),
    ).rejects.toThrow()
  })
})

describe('updateTaskFields y moveTaskToProject (vista de tarea, D-12, D-46)', () => {
  beforeEach(async () => {
    await admin(async (db) => {
      await setDoc(doc(db, 'users', U.active, 'projects', 'p2'), {
        name: 'Casa',
        key: 'CASA',
        color: 'emerald',
        icon: 'home',
        order: 1,
        archived: false,
        taskCounter: 7,
        createdAt: Timestamp.now(),
      })
    })
  })

  const read = async (id: string) =>
    (await readAsAdmin((a) => getDoc(doc(a, 'users', U.active, 'tasks', id)))).data()!

  it('guarda título, prioridad, estimado y enlaces; las reglas rechazan valores inválidos', async () => {
    const db = as(env, U.active)
    const { id } = await createTask(db, U.active, input())
    await updateTaskFields(db, U.active, id, {
      title: 'Nuevo título',
      priority: 'high',
      estimateMin: 1200,
      weblinks: [{ url: 'https://vuejs.org/', title: 'Vue' }],
    })
    expect(await read(id)).toMatchObject({
      title: 'Nuevo título',
      priority: 'high',
      estimateMin: 1200,
      weblinks: [{ url: 'https://vuejs.org/', title: 'Vue' }],
    })
    await expect(updateTaskFields(db, U.active, id, { title: '' })).rejects.toThrow()
    await expect(updateTaskFields(db, U.active, id, { priority: 'urgente' })).rejects.toThrow()
    await expect(updateTaskFields(db, U.active, id, { estimateMin: -1 })).rejects.toThrow()
  })

  it('al mover de proyecto cambia la clave y sus horas pasan al nuevo proyecto', async () => {
    const db = as(env, U.active)
    const { id, key } = await createTask(db, U.active, input())
    expect(key).toBe('EST-1')
    await admin(async (a) => {
      await setDoc(doc(a, 'users', U.active, 'worklogs', 'wx'), {
        ...validWorklog(),
        taskId: id,
        projectId: 'p1',
      })
    })

    expect(await moveTaskToProject(db, U.active, { id, projectId: 'p1' }, 'p2')).toBe('CASA-8')
    expect(await read(id)).toMatchObject({ key: 'CASA-8', projectId: 'p2' })
    const wl = await readAsAdmin((a) => getDoc(doc(a, 'users', U.active, 'worklogs', 'wx')))
    expect(wl.data()?.projectId).toBe('p2')

    expect(await moveTaskToProject(db, U.active, { id, projectId: 'p2' }, null)).toBe('INB-1')
    expect(await moveTaskToProject(db, U.active, { id, projectId: null }, null)).toBeNull()
  })
})

describe('deleteTask en cascada (D-13)', () => {
  beforeEach(async () => {
    await admin(async (db) => {
      const t = (id: string) => doc(db, 'users', U.active, 'tasks', id)
      const base = { ...validTask(), createdAt: Timestamp.now(), updatedAt: Timestamp.now() }
      await setDoc(t('T'), {
        ...base,
        key: 'EST-1',
        links: [
          { type: 'blocks', taskId: 'A' },
          { type: 'relates', taskId: 'B' },
          { type: 'causes', taskId: 'GONE' }, // vínculo a una tarea que ya no existe
        ],
      })
      await setDoc(t('A'), { ...base, key: 'EST-2', links: [{ type: 'blocked_by', taskId: 'T' }] })
      await setDoc(t('B'), {
        ...base,
        key: 'EST-3',
        links: [
          { type: 'relates', taskId: 'T' },
          { type: 'relates', taskId: 'A' },
        ],
      })
      await setDoc(t('S'), { ...base, key: 'EST-4', parentId: 'T' })
      for (const id of ['c1', 'c2'])
        await setDoc(doc(db, 'users', U.active, 'tasks', 'T', 'comments', id), {
          ...validComment(),
          createdAt: Timestamp.now(),
        })
      await setDoc(doc(db, 'users', U.active, 'tasks', 'T', 'activity', 'a1'), {
        field: 'status',
        from: 'pending',
        to: 'in_progress',
        at: Timestamp.now(),
      })
      const w = (id: string, taskId: string) =>
        setDoc(doc(db, 'users', U.active, 'worklogs', id), { ...validWorklog(), taskId })
      await w('w1', 'T')
      await w('w2', 'T')
      await w('w3', 'A') // de otra tarea: se queda
      await setDoc(
        doc(db, 'users', U.active),
        { activeTimer: { taskId: 'T', startedAt: Timestamp.now() } },
        { merge: true },
      )
    })
  })

  it('borra todo lo de la tarea y no deja huérfanos', async () => {
    const db = as(env, U.active)
    const snap = await getDoc(doc(db, 'users', U.active, 'tasks', 'T'))
    const summary = await deleteTask(db, U.active, taskFromData('T', snap.data()!))

    expect(summary).toEqual({
      comments: 2,
      activity: 1,
      worklogs: 2,
      subtasksDetached: 1,
      linksCleaned: 2,
      timerCleared: true,
      trashed: true,
    })

    const after = await readAsAdmin(async (a) => {
      const u = (...p: string[]) => doc(a, 'users', U.active, ...p)
      return {
        task: (await getDoc(u('tasks', 'T'))).exists(),
        comments: (await getDocs(collection(a, 'users', U.active, 'tasks', 'T', 'comments'))).size,
        activity: (await getDocs(collection(a, 'users', U.active, 'tasks', 'T', 'activity'))).size,
        worklogsOfT: (
          await getDocs(
            query(collection(a, 'users', U.active, 'worklogs'), where('taskId', '==', 'T')),
          )
        ).size,
        worklogsOfA: (
          await getDocs(
            query(collection(a, 'users', U.active, 'worklogs'), where('taskId', '==', 'A')),
          )
        ).size,
        linksA: (await getDoc(u('tasks', 'A'))).data()?.links,
        linksB: (await getDoc(u('tasks', 'B'))).data()?.links,
        parentS: (await getDoc(u('tasks', 'S'))).data()?.parentId,
        timer: (await getDoc(u())).data()?.activeTimer,
      }
    })

    expect(after).toEqual({
      task: false,
      comments: 0,
      activity: 0,
      worklogsOfT: 0,
      worklogsOfA: 1,
      linksA: [],
      linksB: [{ type: 'relates', taskId: 'A' }],
      parentS: null,
      timer: null,
    })
  })

  it('la papelera guarda la tarea con sus comentarios y horas, y se restaura (v1.1.0)', async () => {
    const db = as(env, U.active)
    const snap = await getDoc(doc(db, 'users', U.active, 'tasks', 'T'))
    await deleteTask(db, U.active, taskFromData('T', snap.data()!))

    const trash = await readAsAdmin(async (a) =>
      (await getDoc(doc(a, 'users', U.active, 'trash', 'T'))).data(),
    )
    expect(trash?.task.key).toBe('EST-1')
    expect(trash?.comments).toHaveLength(2)
    expect(trash?.worklogs).toHaveLength(2)

    const key = await restoreFromTrash(db, U.active, 'T')
    expect(key).toBe('EST-1')
    const after = await readAsAdmin(async (a) => {
      const u = (...p: string[]) => doc(a, 'users', U.active, ...p)
      return {
        task: (await getDoc(u('tasks', 'T'))).data(),
        comments: (await getDocs(collection(a, 'users', U.active, 'tasks', 'T', 'comments'))).size,
        worklogs: (
          await getDocs(
            query(collection(a, 'users', U.active, 'worklogs'), where('taskId', '==', 'T')),
          )
        ).size,
        linksA: (await getDoc(u('tasks', 'A'))).data()?.links,
        inTrash: (await getDoc(u('trash', 'T'))).exists(),
      }
    })
    expect(after.task?.key).toBe('EST-1')
    // El vínculo con la tarea que ya no existía no vuelve.
    expect(after.task?.links).toEqual([
      { type: 'blocks', taskId: 'A' },
      { type: 'relates', taskId: 'B' },
    ])
    expect(after.comments).toBe(2)
    expect(after.worklogs).toBe(2)
    expect(after.linksA).toEqual([{ type: 'blocked_by', taskId: 'T' }])
    expect(after.inTrash).toBe(false)
  })

  it('con trash: false se borra sin papelera', async () => {
    const db = as(env, U.active)
    const snap = await getDoc(doc(db, 'users', U.active, 'tasks', 'T'))
    const summary = await deleteTask(db, U.active, taskFromData('T', snap.data()!), {
      trash: false,
    })
    expect(summary.trashed).toBe(false)
    const inTrash = await readAsAdmin(async (a) =>
      (await getDoc(doc(a, 'users', U.active, 'trash', 'T'))).exists(),
    )
    expect(inTrash).toBe(false)
  })

  it('otro usuario no puede borrar mis tareas', async () => {
    const snap = await readAsAdmin((a) => getDoc(doc(a, 'users', U.active, 'tasks', 'T')))
    await expect(
      deleteTask(as(env, U.other), U.active, taskFromData('T', snap.data()!)),
    ).rejects.toThrow()
    const still = await readAsAdmin((a) => getDoc(doc(a, 'users', U.active, 'tasks', 'T')))
    expect(still.exists()).toBe(true)
  })
})
