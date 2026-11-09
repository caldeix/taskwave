import { describe, expect, it } from 'vitest'
import { backlogSections, mondayOf, placeAt } from './backlog'
import { taskFromData, type Task } from './task'

function task(id: string, extra: Record<string, unknown> = {}): Task {
  return taskFromData(id, { key: id, title: id, ...extra })
}

describe('mondayOf', () => {
  it('devuelve el lunes de la semana', () => {
    expect(mondayOf('2026-11-09')).toBe('2026-11-09') // lunes
    expect(mondayOf('2026-11-12')).toBe('2026-11-09') // jueves
    expect(mondayOf('2026-11-15')).toBe('2026-11-09') // domingo
    expect(mondayOf('2026-11-01')).toBe('2026-10-26') // cambio de mes
  })
})

describe('backlogSections (idea 8)', () => {
  it('«Esta semana» incluye lo planificado antes y sin terminar; cerradas fuera', () => {
    const tasks = [
      task('A', { plannedWeek: '2026-11-09', rank: 2000 }),
      task('B', { plannedWeek: '2026-11-02', rank: 1000 }),
      task('C', { plannedWeek: '2026-11-16' }),
      task('D'),
      task('E', { plannedWeek: '2026-11-09', status: 'done' }),
    ]
    const s = backlogSections(tasks, '2026-11-09')
    expect(s.week.map((t) => t.id)).toEqual(['B', 'A'])
    expect(s.backlog.map((t) => t.id)).toEqual(['C', 'D'])
  })

  it('las que no tienen orden van al final, por clave', () => {
    const tasks = [task('EST-10'), task('EST-2'), task('EST-5', { rank: 500 })]
    expect(backlogSections(tasks, '2026-11-09').backlog.map((t) => t.id)).toEqual([
      'EST-5',
      'EST-2',
      'EST-10',
    ])
  })
})

describe('placeAt', () => {
  const ranked = [task('A', { rank: 1000 }), task('B', { rank: 2000 }), task('C', { rank: 3000 })]

  it('entre dos vecinas con orden, solo cambia la que se mueve', () => {
    expect(placeAt(ranked, ranked[2]!, 1)).toEqual([{ id: 'C', rank: 1500 }])
  })

  it('al principio y al final', () => {
    expect(placeAt(ranked, ranked[1]!, 0)).toEqual([{ id: 'B', rank: 0 }])
    expect(placeAt(ranked, ranked[0]!, 5)).toEqual([{ id: 'A', rank: 4000 }])
  })

  it('una tarea que llega de la otra sección', () => {
    expect(placeAt(ranked, task('X'), 3)).toEqual([{ id: 'X', rank: 4000 }])
    expect(placeAt([], task('X'), 0)).toEqual([{ id: 'X', rank: 1000 }])
  })

  it('si una vecina no tiene orden, numera la sección entera', () => {
    const mixed = [task('A', { rank: 1000 }), task('B'), task('C')]
    expect(placeAt(mixed, mixed[2]!, 1)).toEqual([
      { id: 'C', rank: 2000 },
      { id: 'B', rank: 3000 },
    ])
  })
})
