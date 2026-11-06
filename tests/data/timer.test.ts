import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore'
import { TimerRunningError, startTimer, stopTimer } from '@/data/timer'
import { U, as, resetAndSeed, setupEnv, validTask } from '../rules/helpers'

/** Cronómetro (step-19) contra el emulador, con las reglas activas. */

let env: RulesTestEnvironment

async function admin<T>(fn: (db: Firestore) => Promise<T>): Promise<T> {
  let result!: T
  await env.withSecurityRulesDisabled(async (ctx) => {
    result = await fn(ctx.firestore() as unknown as Firestore)
  })
  return result
}

const profile = () => admin(async (a) => (await getDoc(doc(a, 'users', U.active))).data())
const task = (id: string) =>
  admin(async (a) => (await getDoc(doc(a, 'users', U.active, 'tasks', id))).data())
const worklogs = () =>
  admin(async (a) =>
    (await getDocs(collection(a, 'users', U.active, 'worklogs'))).docs
      .map((d) => d.data())
      .sort((x, y) => (x.date as string).localeCompare(y.date as string)),
  )

/** Pone un cronómetro empezado en `startedAt` (con las reglas desactivadas). */
const runningSince = (taskId: string, startedAt: Date) =>
  admin((a) =>
    updateDoc(doc(a, 'users', U.active), {
      activeTimer: { taskId, startedAt: Timestamp.fromDate(startedAt) },
    }),
  )

beforeAll(async () => {
  env = await setupEnv()
})
afterAll(async () => {
  await env.cleanup()
})
beforeEach(async () => {
  await resetAndSeed(env)
  await admin(async (a) => {
    await setDoc(doc(a, 'users', U.active, 'tasks', 'T'), { ...validTask(), spentMin: 30 })
    await setDoc(doc(a, 'users', U.active, 'tasks', 'O'), { ...validTask(), key: 'EST-2' })
  })
})

describe('startTimer (D-25, D-26)', () => {
  it('guarda la tarea y la hora del servidor en el perfil', async () => {
    const before = Date.now()
    await startTimer(as(env, U.active), U.active, 'T')
    const timer = (await profile())?.activeTimer
    expect(timer.taskId).toBe('T')
    expect((timer.startedAt as Timestamp).toMillis()).toBeGreaterThanOrEqual(before - 5000)
  })

  it('solo hay uno: si ya hay otro en marcha, falla y dice cuál', async () => {
    const db = as(env, U.active)
    await startTimer(db, U.active, 'T')
    const error = await startTimer(db, U.active, 'O').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(TimerRunningError)
    expect((error as TimerRunningError).taskId).toBe('T')
  })

  it('las reglas no dejan poner una hora de inicio inventada', async () => {
    await expect(
      updateDoc(doc(as(env, U.active), 'users', U.active), {
        activeTimer: { taskId: 'T', startedAt: Timestamp.fromMillis(0) },
      }),
    ).rejects.toThrow()
  })

  it('otro usuario no puede iniciar mi cronómetro', async () => {
    await expect(startTimer(as(env, U.other), U.active, 'T')).rejects.toThrow()
  })
})

describe('stopTimer (D-27, D-28)', () => {
  it('crea el registro, suma las horas a la tarea y quita el cronómetro', async () => {
    const end = new Date()
    await runningSince('T', new Date(end.getTime() - 90 * 60_000))
    const result = await stopTimer(as(env, U.active), U.active, end.getTime())
    expect(result).toEqual({ taskId: 'T', minutes: 90, worklogs: 1 })
    expect((await profile())?.activeTimer).toBeNull()
    const t = await task('T')
    expect(t?.spentMin).toBe(120)
    expect((t?.lastWorkedAt as Timestamp).toMillis()).toBe(end.getTime())
    const [log] = await worklogs()
    expect(log).toMatchObject({ taskId: 'T', projectId: 'p1', minutes: 90, source: 'timer' })
  })

  it('pasada la medianoche, un registro por día', async () => {
    // 23:00 → 01:30 del día siguiente (hora local del equipo que pasa los tests)
    const start = new Date(2026, 10, 5, 23, 0)
    const end = new Date(2026, 10, 6, 1, 30)
    await runningSince('T', start)
    const result = await stopTimer(as(env, U.active), U.active, end.getTime())
    expect(result).toEqual({ taskId: 'T', minutes: 150, worklogs: 2 })
    expect((await worklogs()).map((w) => [w.date, w.minutes])).toEqual([
      ['2026-11-05', 60],
      ['2026-11-06', 90],
    ])
    expect((await task('T'))?.spentMin).toBe(180)
  })

  it('si la tarea ya no existe, solo quita el cronómetro', async () => {
    await runningSince('O', new Date(Date.now() - 3_600_000))
    await admin((a) => deleteDoc(doc(a, 'users', U.active, 'tasks', 'O')))
    const result = await stopTimer(as(env, U.active), U.active)
    expect(result).toEqual({ taskId: 'O', minutes: 0, worklogs: 0 })
    expect((await profile())?.activeTimer).toBeNull()
    expect(await worklogs()).toEqual([])
  })

  it('sin cronómetro en marcha no hace nada', async () => {
    expect(await stopTimer(as(env, U.active), U.active)).toBeNull()
  })

  it('después de parar se puede iniciar otro', async () => {
    const db = as(env, U.active)
    await runningSince('T', new Date(Date.now() - 600_000))
    await stopTimer(db, U.active)
    await startTimer(db, U.active, 'O')
    expect((await profile())?.activeTimer.taskId).toBe('O')
  })
})
