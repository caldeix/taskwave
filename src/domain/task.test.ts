import { describe, expect, it } from 'vitest'
import { taskFromData } from './task'

const ts = (ms: number) => ({ toMillis: () => ms })

describe('taskFromData', () => {
  it('convierte las marcas de tiempo a milisegundos', () => {
    const task = taskFromData('t1', {
      key: 'EST-1',
      title: 'Estudiar',
      status: 'in_progress',
      priority: 'high',
      startDate: '2026-11-05',
      endDate: null,
      spentMin: 90,
      lastWorkedAt: ts(1000),
      resolvedAt: null,
      createdAt: ts(500),
      updatedAt: ts(900),
      tagIds: ['a'],
    })
    expect(task).toMatchObject({
      id: 't1',
      key: 'EST-1',
      status: 'in_progress',
      priority: 'high',
      startDate: '2026-11-05',
      spentMin: 90,
      lastWorkedAtMs: 1000,
      resolvedAtMs: null,
      createdAtMs: 500,
      updatedAtMs: 900,
      tagIds: ['a'],
    })
  })

  it('rellena con valores seguros lo que falte', () => {
    const task = taskFromData('t2', {})
    expect(task).toMatchObject({
      projectId: null,
      status: 'pending',
      priority: 'medium',
      startDate: null,
      spentMin: 0,
      tagIds: [],
      links: [],
      weblinks: [],
      createdAtMs: null,
    })
  })
})
