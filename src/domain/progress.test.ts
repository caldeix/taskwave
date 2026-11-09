import { describe, expect, it } from 'vitest'
import { cardProgress, checklistProgress, progressIndex } from './progress'
import { taskFromData, type Task } from './task'

function task(id: string, extra: Record<string, unknown> = {}): Task {
  return taskFromData(id, { key: id, title: id, ...extra })
}

describe('checklistProgress', () => {
  it('cuenta las casillas marcadas y sin marcar', () => {
    const md = '- [x] uno\n- [ ] dos\n* [X] tres\n1. [ ] cuatro\n- no es casilla'
    expect(checklistProgress(md)).toEqual({ done: 2, total: 4 })
  })

  it('no cuenta las casillas dentro de un bloque de código', () => {
    const md = '- [ ] fuera\n```\n- [x] dentro\n```\n- [x] fuera'
    expect(checklistProgress(md)).toEqual({ done: 1, total: 2 })
  })

  it('sin casillas devuelve null', () => {
    expect(checklistProgress('texto normal')).toBeNull()
    expect(checklistProgress('')).toBeNull()
  })
})

describe('cardProgress (idea 4)', () => {
  it('subtareas cerradas sobre el total, entre las tareas leídas', () => {
    const parent = task('P')
    const tasks = [
      parent,
      task('S1', { parentId: 'P', status: 'done' }),
      task('S2', { parentId: 'P', status: 'in_progress' }),
      task('S3', { parentId: 'P', status: 'discarded' }),
    ]
    expect(cardProgress(parent, progressIndex(tasks)).subtasks).toEqual({ done: 2, total: 3 })
  })

  it('bloqueada solo por tareas abiertas que se conocen', () => {
    const t = task('A', {
      links: [
        { type: 'blocked_by', taskId: 'B' },
        { type: 'blocked_by', taskId: 'C' },
        { type: 'blocked_by', taskId: 'X' },
        { type: 'relates', taskId: 'D' },
      ],
    })
    const tasks = [t, task('B', { key: 'EST-2' }), task('C', { status: 'done' }), task('D')]
    expect(cardProgress(t, progressIndex(tasks)).blockedBy).toEqual(['EST-2'])
  })

  it('horas solo si hay horas o estimado', () => {
    const idx = progressIndex([])
    expect(cardProgress(task('A'), idx).hours).toBeNull()
    expect(cardProgress(task('A', { spentMin: 30 }), idx).hours).toEqual({
      spentMin: 30,
      estimateMin: null,
    })
    expect(cardProgress(task('A', { estimateMin: 60 }), idx).hours).toEqual({
      spentMin: 0,
      estimateMin: 60,
    })
  })
})
