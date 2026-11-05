import { describe, expect, it } from 'vitest'
import {
  MAX_LINKS,
  checkRelation,
  groupLinks,
  inverseLink,
  parseTaskKey,
  relatedIds,
  searchTasks,
  subtaskTotals,
} from './links'
import { taskFromData, type Task, type TaskLink } from './task'

function task(id: string, extra: Record<string, unknown> = {}): Task {
  return taskFromData(id, { key: id, title: id, ...extra })
}

describe('inverseLink (D-41)', () => {
  it('guarda en la otra tarea el tipo contrario', () => {
    expect(inverseLink({ type: 'blocks', taskId: 'B' }, 'A')).toEqual({
      type: 'blocked_by',
      taskId: 'A',
    })
    expect(inverseLink({ type: 'caused_by', taskId: 'B' }, 'A').type).toBe('causes')
    expect(inverseLink({ type: 'relates', taskId: 'B' }, 'A').type).toBe('relates')
  })
})

describe('checkRelation', () => {
  const a = task('A')
  const b = task('B')

  it('no deja vincular una tarea consigo misma', () => {
    expect(checkRelation(a, a, 'relates', false, false)).toBe('self')
    expect(checkRelation(a, a, 'parent', false, false)).toBe('self')
  })

  it('no repite el mismo vínculo, pero sí permite otro tipo con la misma tarea', () => {
    const linked = task('A', { links: [{ type: 'blocks', taskId: 'B' }] })
    expect(checkRelation(linked, b, 'blocks', false, false)).toBe('duplicate')
    expect(checkRelation(linked, b, 'causes', false, false)).toBeNull()
  })

  it('respeta el máximo de vínculos en las dos tareas', () => {
    const full: TaskLink[] = Array.from({ length: MAX_LINKS }, (_, i) => ({
      type: 'relates',
      taskId: `X${i}`,
    }))
    expect(checkRelation(task('A', { links: full }), b, 'relates', false, false)).toBe(
      'tooManyLinks',
    )
    expect(checkRelation(a, task('B', { links: full }), 'relates', false, false)).toBe(
      'targetTooManyLinks',
    )
  })

  it('subtareas de un solo nivel', () => {
    // A pasa a ser subtarea de B
    expect(checkRelation(a, b, 'parent', false, false)).toBeNull()
    expect(checkRelation(task('A', { parentId: 'B' }), b, 'parent', false, false)).toBe(
      'alreadyParent',
    )
    expect(checkRelation(a, b, 'parent', true, false)).toBe('hasSubtasks')
    expect(checkRelation(a, task('B', { parentId: 'C' }), 'parent', false, false)).toBe(
      'parentIsSubtask',
    )
    // B pasa a ser subtarea de A
    expect(checkRelation(a, b, 'child', false, false)).toBeNull()
    expect(checkRelation(a, task('B', { parentId: 'A' }), 'child', false, false)).toBe(
      'alreadyChild',
    )
    expect(checkRelation(task('A', { parentId: 'C' }), b, 'child', false, false)).toBe(
      'subtaskCannotHaveSubtasks',
    )
    expect(checkRelation(a, b, 'child', false, true)).toBe('targetHasSubtasks')
  })

  it('una subtarea de otra padre puede cambiar de padre', () => {
    expect(checkRelation(a, task('B', { parentId: 'C' }), 'child', false, false)).toBeNull()
  })
})

describe('groupLinks y relatedIds', () => {
  const links: TaskLink[] = [
    { type: 'relates', taskId: 'C' },
    { type: 'blocks', taskId: 'B' },
    { type: 'blocks', taskId: 'B' },
    { type: 'caused_by', taskId: 'C' },
  ]

  it('agrupa por tipo en el orden de Jira y sin repetidos', () => {
    expect(groupLinks(links)).toEqual([
      { type: 'blocks', taskIds: ['B'] },
      { type: 'caused_by', taskIds: ['C'] },
      { type: 'relates', taskIds: ['C'] },
    ])
  })

  it('junta las vinculadas y la padre, sin repetir', () => {
    expect(relatedIds(task('A', { links, parentId: 'P' })).sort()).toEqual(['B', 'C', 'P'])
    expect(relatedIds(task('A'))).toEqual([])
  })
})

describe('subtaskTotals (D-32, CA-15)', () => {
  it('suma las horas y los estimados de la padre y sus subtareas', () => {
    const parent = task('P', { spentMin: 60, estimateMin: 120 })
    const subs = [
      task('S1', { spentMin: 30, estimateMin: 60, status: 'done' }),
      task('S2', { spentMin: 90, estimateMin: null }),
    ]
    expect(subtaskTotals(parent, subs)).toEqual({
      count: 2,
      closed: 1,
      ownSpentMin: 60,
      subtasksSpentMin: 120,
      totalSpentMin: 180,
      totalEstimateMin: 180,
    })
  })

  it('sin estimados, el total estimado es null', () => {
    expect(subtaskTotals(task('P'), [task('S')]).totalEstimateMin).toBeNull()
    expect(subtaskTotals(task('P', { spentMin: 15 }), []).totalSpentMin).toBe(15)
  })
})

describe('parseTaskKey', () => {
  it('reconoce claves en cualquier caja y con espacios', () => {
    expect(parseTaskKey(' est-12 ')).toBe('EST-12')
    expect(parseTaskKey('INB-3')).toBe('INB-3')
    expect(parseTaskKey('estudiar')).toBeNull()
    expect(parseTaskKey('EST-')).toBeNull()
  })
})

describe('searchTasks', () => {
  const tasks = [
    task('1', { key: 'EST-12', title: 'Repasar la lección', status: 'done' }),
    task('2', { key: 'EST-3', title: 'Lección de redes' }),
    task('3', { key: 'CASA-1', title: 'Comprar pan' }),
    task('4', { key: 'TRB-120', title: 'Desplegar EST' }),
  ]

  it('busca por título sin tildes y pone primero las abiertas', () => {
    expect(searchTasks(tasks, 'leccion', new Set()).map((t) => t.key)).toEqual(['EST-3', 'EST-12'])
  })

  it('las que empiezan por la clave van primero', () => {
    expect(searchTasks(tasks, 'est-1', new Set()).map((t) => t.key)).toEqual(['EST-12'])
    expect(searchTasks(tasks, 'est', new Set()).map((t) => t.key)).toEqual([
      'EST-3',
      'EST-12',
      'TRB-120',
    ])
  })

  it('todas las palabras deben aparecer, y respeta las excluidas y el máximo', () => {
    expect(searchTasks(tasks, 'lección redes', new Set()).map((t) => t.key)).toEqual(['EST-3'])
    expect(searchTasks(tasks, 'leccion', new Set(['2'])).map((t) => t.key)).toEqual(['EST-12'])
    expect(searchTasks(tasks, 'e', new Set(), 2)).toHaveLength(2)
    expect(searchTasks(tasks, '   ', new Set())).toEqual([])
  })
})
