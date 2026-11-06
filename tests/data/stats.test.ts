import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { Timestamp, doc, writeBatch, type Firestore } from 'firebase/firestore'
import { loadStats } from '@/data/stats'
import { worklogsCollection } from '@/data/worklogs'
import { U, as, resetAndSeed, setupEnv, validTask, validWorklog } from '../rules/helpers'

/** Lecturas de las estadísticas (step-23) contra el emulador, con las reglas activas. */

let env: RulesTestEnvironment
const RANGE = { from: '2026-11-01', to: '2026-11-30' }

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
    const batch = writeBatch(db)
    const task = (id: string, extra: Record<string, unknown> = {}) =>
      batch.set(doc(db, 'users', U.active, 'tasks', id), {
        ...validTask(),
        key: `EST-${id}`,
        ...extra,
      })
    task('1', { tagIds: ['uni'] })
    task('2', { status: 'done', resolvedAt: Timestamp.fromDate(new Date('2026-11-30T23:00:00')) })
    task('3', { status: 'done', resolvedAt: Timestamp.fromDate(new Date('2026-12-01T00:30:00')) })
    task('4', { status: 'ko', resolvedAt: Timestamp.fromDate(new Date('2026-10-31T23:59:00')) })
    const log = (id: string, taskId: string, date: string) =>
      batch.set(doc(worklogsCollection(db, U.active), id), { ...validWorklog(), taskId, date })
    log('a', '1', '2026-11-01')
    log('b', '2', '2026-11-30')
    log('c', '1', '2026-12-01') // fuera
    log('d', '3', '2026-10-31') // fuera
    await batch.commit()
  })
})

describe('loadStats', () => {
  it('lee las horas del periodo, las cerradas en él y las tareas de esas horas', async () => {
    const data = await loadStats(as(env, U.active), U.active, RANGE)
    expect(data.logs.map((l) => l.id).sort()).toEqual(['a', 'b'])
    expect(data.closed.map((t) => t.id)).toEqual(['2'])
    expect([...data.tasks.keys()].sort()).toEqual(['1', '2'])
    expect(data.tasks.get('1')?.tagIds).toEqual(['uni'])
  })

  it('otro usuario no puede leer mis estadísticas', async () => {
    await expect(loadStats(as(env, U.other), U.active, RANGE)).rejects.toThrow()
  })
})
