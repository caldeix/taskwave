import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { Timestamp, doc, getDocs, setDoc, type Firestore, type Query } from 'firebase/firestore'
import {
  closedSinceQuery,
  openQuery,
  rangeQueries,
  startedQuery,
  undatedQuery,
} from '@/data/taskQueries'
import type { TaskScope } from '@/domain/task'
import { U, as, resetAndSeed, setupEnv, validTask } from '../rules/helpers'

/**
 * Consultas del step-9 contra el emulador: comprueban la semántica real de Firestore
 * (rangos, nulos, `in`) y que las reglas dejan hacerlas al dueño con la cuenta activa.
 */
let env: RulesTestEnvironment

const NOV = { from: '2026-11-01', to: '2026-11-30' }
const ALL: TaskScope = { kind: 'all' }
const INBOX: TaskScope = { kind: 'inbox' }
const P1: TaskScope = { kind: 'project', projectId: 'p1' }

interface Fixture {
  start: string | null
  end?: string | null
  project?: string | null
  status?: string
  resolved?: string
  worked?: string
}

const FIXTURES: Record<string, Fixture> = {
  a: { start: '2026-11-05', project: 'p1' }, // dentro, un día
  b: { start: '2026-10-28', end: '2026-11-02', project: 'p1' }, // empieza antes y entra
  c: { start: '2026-11-29', end: '2026-12-03', project: 'p2' }, // empieza dentro y sale
  d: { start: '2026-10-01', end: '2026-12-31', project: null }, // cubre todo el mes
  e: { start: '2026-10-01', end: '2026-10-31', project: 'p1' }, // termina antes
  f: { start: '2026-12-01', project: 'p2' }, // después
  g: { start: '2026-10-31', project: null }, // un día antes, sin fin
  h: { start: null, project: 'p1' }, // sin fecha
  i: { start: '2026-11-30', project: null }, // último día
  // estados para el kanban y las iniciadas
  open1: { start: null, status: 'in_progress', worked: '2026-11-04T10:00:00Z', project: 'p1' },
  open2: { start: null, status: 'paused', worked: '2026-11-05T10:00:00Z', project: null },
  open3: { start: null, status: 'pending', worked: '2026-11-01T10:00:00Z', project: 'p2' },
  done1: {
    start: null,
    status: 'done',
    resolved: '2026-11-03T10:00:00Z',
    worked: '2026-11-06T10:00:00Z',
    project: 'p2',
  },
  done2: { start: null, status: 'ko', resolved: '2026-09-01T10:00:00Z', project: 'p2' },
  disc1: { start: null, status: 'discarded', resolved: '2026-11-02T10:00:00Z', project: 'p1' },
}

async function seedTasks(): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore
    for (const [id, f] of Object.entries(FIXTURES)) {
      await setDoc(doc(db, 'users', U.active, 'tasks', id), {
        ...validTask(),
        key: `EST-${id.length}`,
        projectId: f.project === undefined ? 'p1' : f.project,
        startDate: f.start,
        endDate: f.end ?? null,
        status: f.status ?? 'pending',
        resolvedAt: f.resolved ? Timestamp.fromDate(new Date(f.resolved)) : null,
        lastWorkedAt: f.worked ? Timestamp.fromDate(new Date(f.worked)) : null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
    }
  })
}

async function ids(queries: Query | Query[]): Promise<string[]> {
  const list = Array.isArray(queries) ? queries : [queries]
  const found = new Set<string>()
  for (const q of list) (await getDocs(q)).docs.forEach((d) => found.add(d.id))
  return [...found].sort()
}

beforeAll(async () => {
  env = await setupEnv()
})
afterAll(async () => {
  await env.cleanup()
})
beforeEach(async () => {
  await resetAndSeed(env)
  await seedTasks()
})

describe('rangeQueries (calendario y periodos, D-20, D-37)', () => {
  it('devuelve las tareas que se solapan con el mes, incluidas las de varios días', async () => {
    const db = as(env, U.active)
    expect(await ids(rangeQueries(db, U.active, NOV, ALL))).toEqual(['a', 'b', 'c', 'd', 'i'])
  })

  it('respeta el ámbito: bandeja o proyecto', async () => {
    const db = as(env, U.active)
    expect(await ids(rangeQueries(db, U.active, NOV, INBOX))).toEqual(['d', 'i'])
    expect(await ids(rangeQueries(db, U.active, NOV, P1))).toEqual(['a', 'b'])
  })

  it('un rango de un solo día', async () => {
    const db = as(env, U.active)
    const day = { from: '2026-11-02', to: '2026-11-02' }
    expect(await ids(rangeQueries(db, U.active, day, ALL))).toEqual(['b', 'd'])
  })
})

describe('undatedQuery (panel «Sin fecha», D-19)', () => {
  it('solo las tareas sin fecha de inicio', async () => {
    const db = as(env, U.active)
    const undated = await ids(undatedQuery(db, U.active, ALL))
    expect(undated).toContain('h')
    expect(undated).not.toContain('a')
    expect(await ids(undatedQuery(db, U.active, P1))).toEqual(['disc1', 'h', 'open1'])
  })
})

describe('kanban: abiertas y cerradas (D-36)', () => {
  it('abiertas: pendiente, en curso y paralizada', async () => {
    const db = as(env, U.active)
    const open = await ids(openQuery(db, U.active, ALL))
    expect(open).toEqual(expect.arrayContaining(['open1', 'open2', 'open3', 'a']))
    expect(open).not.toContain('done1')
    expect(open).not.toContain('disc1')
  })

  it('cerradas desde una fecha (las antiguas no se leen)', async () => {
    const db = as(env, U.active)
    const since = Date.parse('2026-10-15T00:00:00Z')
    expect(await ids(closedSinceQuery(db, U.active, ALL, since))).toEqual(['disc1', 'done1'])
    expect(await ids(closedSinceQuery(db, U.active, P1, since))).toEqual(['disc1'])
  })
})

describe('startedQuery (tareas iniciadas, D-33)', () => {
  it('abiertas con horas, de la última trabajada a la más antigua, con límite', async () => {
    const db = as(env, U.active)
    const snap = await getDocs(startedQuery(db, U.active, ALL))
    expect(snap.docs.map((d) => d.id)).toEqual(['open2', 'open1', 'open3'])
    const two = await getDocs(startedQuery(db, U.active, ALL, 2))
    expect(two.docs.map((d) => d.id)).toEqual(['open2', 'open1'])
  })
})

describe('las consultas respetan las reglas', () => {
  it('otro usuario no puede lanzarlas sobre mis tareas', async () => {
    const intruder = as(env, U.other)
    await expect(getDocs(rangeQueries(intruder, U.active, NOV, ALL)[0]!)).rejects.toThrow()
    await expect(getDocs(openQuery(intruder, U.active, ALL))).rejects.toThrow()
  })
})
