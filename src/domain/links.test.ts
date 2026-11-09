import { describe, expect, it } from 'vitest'
import {
  MAX_LINKS,
  addRelation,
  checkRelation,
  checkRelationChange,
  groupLinks,
  inverseLink,
  parseTaskKey,
  relatedIds,
  removeRelation,
  searchTasks,
  subtaskTotals,
  swapsParent,
  type RelationPair,
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

describe('cambiar el tipo de una relación (v1.0.2)', () => {
  const pair = (self: Partial<RelationPair['self']>, other: Partial<RelationPair['other']>) => ({
    selfId: 'A',
    self: { links: [], parentId: null, ...self },
    otherId: 'B',
    other: { links: [], parentId: null, ...other },
  })

  it('de «relacionada con» a «bloquea a» cambia el vínculo en las dos tareas', () => {
    const start = pair(
      {
        links: [
          { type: 'relates', taskId: 'B' },
          { type: 'causes', taskId: 'C' },
        ],
      },
      { links: [{ type: 'relates', taskId: 'A' }] },
    )
    const end = addRelation(removeRelation(start, 'relates'), 'blocks')
    expect(end.self.links).toEqual([
      { type: 'causes', taskId: 'C' },
      { type: 'blocks', taskId: 'B' },
    ])
    expect(end.other.links).toEqual([{ type: 'blocked_by', taskId: 'A' }])
  })

  it('de vínculo a subtarea: quita el vínculo y pone la padre', () => {
    const start = pair(
      { links: [{ type: 'relates', taskId: 'B' }] },
      { links: [{ type: 'relates', taskId: 'A' }] },
    )
    const asParent = addRelation(removeRelation(start, 'relates'), 'parent')
    expect(asParent.self).toEqual({ links: [], parentId: 'B' })
    expect(asParent.other).toEqual({ links: [], parentId: null })
    const asChild = addRelation(removeRelation(start, 'relates'), 'child')
    expect(asChild.other.parentId).toBe('A')
  })

  it('de subtarea a vínculo: suelta la hija y vincula', () => {
    const start = pair({}, { parentId: 'A' })
    const end = addRelation(removeRelation(start, 'child'), 'relates')
    expect(end.other).toEqual({ links: [{ type: 'relates', taskId: 'A' }], parentId: null })
    expect(end.self.links).toEqual([{ type: 'relates', taskId: 'B' }])
  })

  it('no quita una padre que no es la de la relación', () => {
    const start = pair({ parentId: 'Z' }, {})
    expect(removeRelation(start, 'parent')).toEqual(start)
  })

  it('intercambiar padre e hija va en dos pasos', () => {
    expect(swapsParent('parent', 'child')).toBe(true)
    expect(swapsParent('child', 'parent')).toBe(true)
    expect(swapsParent('relates', 'child')).toBe(false)
  })

  it('comprueba el cambio como si la relación anterior ya no estuviera', () => {
    const a = task('A', { links: [{ type: 'relates', taskId: 'B' }] })
    const b = task('B', { links: [{ type: 'relates', taskId: 'A' }] })
    expect(checkRelationChange(a, b, 'relates', 'blocks', 0, 0)).toBeNull()
    expect(checkRelationChange(a, b, 'relates', 'relates', 0, 0)).toBeNull()
    // B tiene subtareas: no puede pasar a ser subtarea de A.
    expect(checkRelationChange(a, b, 'relates', 'child', 0, 1)).toBe('targetHasSubtasks')
    // A tiene subtareas: no puede pasar a ser subtarea de B.
    expect(checkRelationChange(a, b, 'relates', 'parent', 2, 0)).toBe('hasSubtasks')
  })

  it('al intercambiar padre e hija descuenta la propia relación', () => {
    // B es la única subtarea de A: puede pasar a ser su padre.
    const a = task('A')
    const b = task('B', { parentId: 'A' })
    expect(checkRelationChange(a, b, 'child', 'parent', 1, 0)).toBeNull()
    // Si A tiene más subtareas, no.
    expect(checkRelationChange(a, b, 'child', 'parent', 2, 0)).toBe('hasSubtasks')
    // A es la única subtarea de B: B puede pasar a ser su hija.
    const c = task('C', { parentId: 'D' })
    const d = task('D')
    expect(checkRelationChange(c, d, 'parent', 'child', 0, 1)).toBeNull()
  })

  it('no deja cambiar a un vínculo que ya existe con otro tipo', () => {
    const a = task('A', {
      links: [
        { type: 'relates', taskId: 'B' },
        { type: 'blocks', taskId: 'B' },
      ],
    })
    const b = task('B', {
      links: [
        { type: 'relates', taskId: 'A' },
        { type: 'blocked_by', taskId: 'A' },
      ],
    })
    expect(checkRelationChange(a, b, 'relates', 'blocks', 0, 0)).toBe('duplicate')
  })
})
