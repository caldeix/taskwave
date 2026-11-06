import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { Timestamp, doc, getDoc, getDocs, setDoc, type Firestore } from 'firebase/firestore'
import {
  addWorklog,
  deleteWorklog,
  taskWorklogsQuery,
  updateWorklog,
  worklogsCollection,
} from '@/data/worklogs'
import type { Entry } from '@/domain/worklog'
import { U, as, resetAndSeed, setupEnv, validTask, validWorklog } from '../rules/helpers'

/** Registro de horas (step-20) contra el emulador, con las reglas activas. */

let env: RulesTestEnvironment

async function admin<T>(fn: (db: Firestore) => Promise<T>): Promise<T> {
  let result!: T
  await env.withSecurityRulesDisabled(async (ctx) => {
    result = await fn(ctx.firestore() as unknown as Firestore)
  })
  return result
}

const task = () =>
  admin(async (a) => (await getDoc(doc(a, 'users', U.active, 'tasks', 'T'))).data())
const log = (id: string) =>
  admin(async (a) => (await getDoc(doc(worklogsCollection(a, U.active), id))).data())

const entry = (date: string, hour: number, minutes: number, note = ''): Entry => {
  const startMs = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`).getTime()
  return { date, minutes, startMs, endMs: startMs + minutes * 60_000, note }
}

beforeAll(async () => {
  env = await setupEnv()
})
afterAll(async () => {
  await env.cleanup()
})
beforeEach(async () => {
  await resetAndSeed(env)
  await admin(async (a) => {
    await setDoc(doc(a, 'users', U.active, 'tasks', 'T'), {
      ...validTask(),
      spentMin: 60,
      lastWorkedAt: Timestamp.fromDate(new Date('2026-11-01T10:00:00')),
    })
    // Un registro previo del cronómetro de 60 min.
    await setDoc(doc(worklogsCollection(a, U.active), 'W1'), {
      ...validWorklog(),
      taskId: 'T',
      date: '2026-11-01',
      minutes: 60,
      source: 'timer',
    })
  })
})

describe('addWorklog (D-29)', () => {
  it('crea la entrada a mano y suma sus minutos a la tarea', async () => {
    const id = await addWorklog(
      as(env, U.active),
      U.active,
      'T',
      entry('2026-11-05', 9, 90, 'Repaso'),
    )
    expect(await log(id)).toMatchObject({
      taskId: 'T',
      projectId: 'p1',
      date: '2026-11-05',
      minutes: 90,
      source: 'manual',
      note: 'Repaso',
    })
    const t = await task()
    expect(t?.spentMin).toBe(150)
    expect((t?.lastWorkedAt as Timestamp).toMillis()).toBe(
      new Date('2026-11-05T10:30:00').getTime(),
    )
  })

  it('una entrada antigua no cambia la última vez trabajada', async () => {
    await addWorklog(as(env, U.active), U.active, 'T', entry('2026-10-20', 9, 30))
    expect((await task())?.lastWorkedAt.toMillis()).toBe(new Date('2026-11-01T10:00:00').getTime())
  })

  it('las reglas rechazan más de 24 h y otro usuario no puede añadir horas', async () => {
    await expect(
      addWorklog(as(env, U.active), U.active, 'T', entry('2026-11-05', 0, 1441)),
    ).rejects.toThrow()
    await expect(
      addWorklog(as(env, U.other), U.active, 'T', entry('2026-11-05', 9, 30)),
    ).rejects.toThrow()
    expect((await task())?.spentMin).toBe(60)
  })
})

describe('updateWorklog y deleteWorklog', () => {
  it('editar ajusta el total con la diferencia y conserva el origen', async () => {
    await updateWorklog(as(env, U.active), U.active, 'W1', entry('2026-11-02', 8, 45, 'corregido'))
    expect(await log('W1')).toMatchObject({
      date: '2026-11-02',
      minutes: 45,
      note: 'corregido',
      source: 'timer',
    })
    expect((await task())?.spentMin).toBe(45)
  })

  it('borrar resta sus minutos de la tarea, sin bajar de cero', async () => {
    await admin((a) =>
      setDoc(doc(a, 'users', U.active, 'tasks', 'T'), { spentMin: 20 }, { merge: true }),
    )
    await deleteWorklog(as(env, U.active), U.active, 'W1')
    expect(await log('W1')).toBeUndefined()
    expect((await task())?.spentMin).toBe(0)
  })

  it('otro usuario no puede editar ni borrar mis horas', async () => {
    const intruder = as(env, U.other)
    await expect(
      updateWorklog(intruder, U.active, 'W1', entry('2026-11-02', 8, 10)),
    ).rejects.toThrow()
    await expect(deleteWorklog(intruder, U.active, 'W1')).rejects.toThrow()
    expect((await log('W1'))?.minutes).toBe(60)
  })
})

describe('taskWorklogsQuery', () => {
  it('devuelve los de la tarea, del día más reciente al más antiguo', async () => {
    const db = as(env, U.active)
    await addWorklog(db, U.active, 'T', entry('2026-11-03', 16, 30))
    await addWorklog(db, U.active, 'T', entry('2026-11-03', 9, 30))
    await admin((a) =>
      setDoc(doc(worklogsCollection(a, U.active), 'OTRA'), { ...validWorklog(), taskId: 'X' }),
    )
    const snap = await getDocs(taskWorklogsQuery(db, U.active, 'T', 10))
    expect(snap.docs.map((d) => [d.data().date, d.data().startedAt.toDate().getHours()])).toEqual([
      ['2026-11-03', 16],
      ['2026-11-03', 9],
      ['2026-11-01', 9],
    ])
  })
})
