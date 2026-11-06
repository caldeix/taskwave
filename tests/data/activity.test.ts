import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { Timestamp, collection, doc, getDocs, setDoc, type Firestore } from 'firebase/firestore'
import { activityQuery } from '@/data/activity'
import {
  createTask,
  moveTaskToProject,
  updateTaskDates,
  updateTaskFields,
  updateTaskStatus,
} from '@/data/taskWrites'
import { U, as, resetAndSeed, setupEnv, validTask } from '../rules/helpers'

/** Actividad de las tareas (step-22, D-42) contra el emulador, con las reglas activas. */

let env: RulesTestEnvironment

async function activityOf(taskId: string) {
  let rows: Record<string, unknown>[] = []
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore
    const snap = await getDocs(collection(db, 'users', U.active, 'tasks', taskId, 'activity'))
    rows = snap.docs.map((d) => {
      const { at, ...rest } = d.data()
      expect(at).toBeInstanceOf(Timestamp)
      return rest
    })
  })
  return rows
}

const before = {
  status: 'pending' as const,
  startDate: '2026-11-05',
  endDate: '2026-11-07',
  estimateMin: 120,
  priority: 'medium' as const,
  projectId: 'p1',
  title: 'Estudiar el tema 1',
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
    for (const [id, key] of [
      ['p1', 'EST'],
      ['p2', 'CASA'],
    ] as const)
      await setDoc(doc(db, 'users', U.active, 'projects', id), {
        name: key,
        key,
        color: 'blue',
        icon: 'folder',
        order: 0,
        archived: false,
        taskCounter: 0,
        createdAt: Timestamp.now(),
      })
  })
})

describe('la actividad se escribe con cada cambio (CA-16)', () => {
  it('estado con sus automatismos de fechas', async () => {
    await updateTaskStatus(
      as(env, U.active),
      U.active,
      'T',
      { status: 'done', resolvedAt: 'now', endDate: '2026-11-08' },
      before,
    )
    expect(await activityOf('T')).toEqual(
      expect.arrayContaining([
        { field: 'status', from: 'pending', to: 'done' },
        { field: 'endDate', from: '2026-11-07', to: '2026-11-08' },
      ]),
    )
    expect(await activityOf('T')).toHaveLength(2)
  })

  it('fechas, prioridad, estimado y título; no la descripción ni los cambios sin efecto', async () => {
    const db = as(env, U.active)
    await updateTaskDates(db, U.active, 'T', { startDate: '2026-11-10', endDate: null }, before)
    await updateTaskFields(
      db,
      U.active,
      'T',
      { priority: 'high', estimateMin: null, title: 'Nuevo', description: 'x' },
      before,
    )
    await updateTaskFields(db, U.active, 'T', { priority: 'medium' }, before)
    const rows = await activityOf('T')
    expect(rows).toHaveLength(5)
    expect(rows).toEqual(
      expect.arrayContaining([
        { field: 'startDate', from: '2026-11-05', to: '2026-11-10' },
        { field: 'endDate', from: '2026-11-07', to: null },
        { field: 'priority', from: 'medium', to: 'high' },
        { field: 'estimateMin', from: 120, to: null },
        { field: 'title', from: 'Estudiar el tema 1', to: 'Nuevo' },
      ]),
    )
  })

  it('el alta y el cambio de proyecto', async () => {
    const db = as(env, U.active)
    const { id, key } = await createTask(db, U.active, {
      title: 'Nueva',
      projectId: 'p1',
      startDate: null,
      endDate: null,
      priority: 'low',
    })
    await moveTaskToProject(db, U.active, { id, projectId: 'p1' }, 'p2')
    expect(await activityOf(id)).toEqual(
      expect.arrayContaining([
        { field: 'created', from: null, to: key },
        { field: 'projectId', from: 'p1', to: 'p2' },
      ]),
    )
  })

  it('sin valores de antes no se apunta nada (escrituras internas)', async () => {
    await updateTaskFields(as(env, U.active), U.active, 'T', { priority: 'high' })
    expect(await activityOf('T')).toEqual([])
  })
})

describe('activityQuery', () => {
  it('lo más reciente primero y nadie más puede leerla', async () => {
    const db = as(env, U.active)
    await updateTaskFields(db, U.active, 'T', { priority: 'high' }, before)
    await new Promise((r) => setTimeout(r, 20))
    await updateTaskFields(db, U.active, 'T', { title: 'Otro' }, before)
    const snap = await getDocs(activityQuery(db, U.active, 'T', 10))
    expect(snap.docs.map((d) => d.data().field)).toEqual(['title', 'priority'])
    await expect(getDocs(activityQuery(as(env, U.other), U.active, 'T', 10))).rejects.toThrow()
  })
})
