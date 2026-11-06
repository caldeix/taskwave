import { describe, expect, it } from 'vitest'
import { activityChanges, activityFromData } from './activity'

describe('activityChanges (D-42, CA-16)', () => {
  const before = {
    status: 'pending',
    startDate: '2026-11-05',
    endDate: null,
    estimateMin: 120,
    priority: 'medium',
    projectId: 'p1',
    title: 'Estudiar',
  }

  it('apunta los campos vigilados que cambian', () => {
    expect(
      activityChanges(before, {
        status: 'done',
        endDate: '2026-11-06',
        resolvedAt: 'ahora',
        updatedAt: 'ahora',
      }),
    ).toEqual([
      { field: 'status', from: 'pending', to: 'done' },
      { field: 'endDate', from: null, to: '2026-11-06' },
    ])
  })

  it('no apunta lo que no cambia ni los campos que no se vigilan', () => {
    expect(
      activityChanges(before, { priority: 'medium', description: 'x', tagIds: ['a'] }),
    ).toEqual([])
    expect(activityChanges(before, { estimateMin: null })).toEqual([
      { field: 'estimateMin', from: 120, to: null },
    ])
  })

  it('la bandeja es `null` y los valores raros se guardan como null', () => {
    expect(activityChanges(before, { projectId: null })).toEqual([
      { field: 'projectId', from: 'p1', to: null },
    ])
    expect(activityChanges({ title: { raro: 1 } }, { title: 'Nuevo' })).toEqual([
      { field: 'title', from: null, to: 'Nuevo' },
    ])
  })
})

describe('activityFromData', () => {
  it('lee una entrada de Firestore', () => {
    expect(
      activityFromData('a1', {
        field: 'status',
        from: 'pending',
        to: 'done',
        at: { toMillis: () => 5 },
      }),
    ).toEqual({ id: 'a1', field: 'status', from: 'pending', to: 'done', atMs: 5 })
  })
})
