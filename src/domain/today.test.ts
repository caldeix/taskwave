import { describe, expect, it } from 'vitest'
import { isToday, todaySections } from './today'
import { taskFromData, type Task } from './task'

function task(id: string, extra: Record<string, unknown> = {}): Task {
  return taskFromData(id, { key: id, title: id, ...extra })
}

const TODAY = '2026-11-09'

describe('isToday', () => {
  it('incluye las que empiezan, terminan o pasan por hoy', () => {
    expect(isToday({ startDate: TODAY, endDate: null }, TODAY)).toBe(true)
    expect(isToday({ startDate: '2026-11-01', endDate: TODAY }, TODAY)).toBe(true)
    expect(isToday({ startDate: '2026-11-01', endDate: '2026-11-30' }, TODAY)).toBe(true)
    expect(isToday({ startDate: '2026-11-10', endDate: null }, TODAY)).toBe(false)
    expect(isToday({ startDate: null, endDate: null }, TODAY)).toBe(false)
  })
})

describe('todaySections (idea 1)', () => {
  it('cada tarea abierta sale en una sola sección y las cerradas en ninguna', () => {
    const tasks = [
      task('A', { endDate: '2026-11-05', startDate: '2026-11-01' }),
      task('B', { startDate: TODAY }),
      task('C', { status: 'in_progress', startDate: '2026-11-20' }),
      task('D', { status: 'in_progress', endDate: '2026-11-02', startDate: '2026-11-01' }),
      task('E', { status: 'done', startDate: TODAY }),
      task('F'),
    ]
    const s = todaySections(tasks, TODAY)
    expect(s.overdue.map((t) => t.id)).toEqual(['D', 'A'])
    expect(s.today.map((t) => t.id)).toEqual(['B'])
    expect(s.inProgress.map((t) => t.id)).toEqual(['C'])
  })
})
