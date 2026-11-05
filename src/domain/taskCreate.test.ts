import { describe, expect, it } from 'vitest'
import {
  buildNewTask,
  removeLinksTo,
  taskKey,
  validateNewTask,
  type NewTaskInput,
} from './taskCreate'

const base: NewTaskInput = {
  title: 'Estudiar el tema 3',
  projectId: 'p1',
  startDate: '2026-11-05',
  endDate: null,
  priority: 'medium',
}

describe('validateNewTask', () => {
  it('acepta tareas con o sin fechas (D-19)', () => {
    expect(validateNewTask(base)).toEqual({})
    expect(validateNewTask({ ...base, startDate: null })).toEqual({})
    expect(validateNewTask({ ...base, endDate: '2026-11-07' })).toEqual({})
  })

  it('exige un título corto', () => {
    expect(validateNewTask({ ...base, title: '   ' }).title).toBe('tasks.validation.titleRequired')
    expect(validateNewTask({ ...base, title: 'x'.repeat(201) }).title).toBe(
      'tasks.validation.titleTooLong',
    )
  })

  it('la fecha fin necesita inicio y no puede ser anterior', () => {
    expect(validateNewTask({ ...base, startDate: null, endDate: '2026-11-07' }).endDate).toBe(
      'tasks.validation.endWithoutStart',
    )
    expect(validateNewTask({ ...base, endDate: '2026-11-01' }).endDate).toBe(
      'tasks.validation.endBeforeStart',
    )
    expect(validateNewTask({ ...base, startDate: '2026-02-30' }).startDate).toBe(
      'tasks.validation.dateInvalid',
    )
  })
})

describe('taskKey (D-12)', () => {
  it('usa la clave del proyecto o INB para la bandeja', () => {
    expect(taskKey('EST', 12)).toBe('EST-12')
    expect(taskKey(null, 1)).toBe('INB-1')
  })
})

describe('buildNewTask', () => {
  const now = { servidor: true }

  it('nace pendiente, sin horas y con todos los campos (D-15)', () => {
    const task = buildNewTask({ ...base, title: '  Estudiar  ' }, 'EST-1', now)
    expect(task).toMatchObject({
      key: 'EST-1',
      title: 'Estudiar',
      status: 'pending',
      priority: 'medium',
      spentMin: 0,
      description: '',
      createdAt: now,
      updatedAt: now,
    })
    expect(Object.keys(task)).toHaveLength(18)
    expect(task.parentId).toBeNull()
  })

  it('una subtarea nace con su padre (step-16)', () => {
    expect(buildNewTask({ ...base, parentId: 'padre' }, 'EST-2', now).parentId).toBe('padre')
  })

  it('una fecha fin igual al inicio se guarda como tarea de un día', () => {
    expect(buildNewTask({ ...base, endDate: '2026-11-05' }, 'EST-1', now).endDate).toBeNull()
    expect(buildNewTask({ ...base, endDate: '2026-11-06' }, 'EST-1', now).endDate).toBe(
      '2026-11-06',
    )
  })
})

describe('removeLinksTo (D-13)', () => {
  it('quita los vínculos hacia la tarea borrada y deja los demás', () => {
    const links = [
      { type: 'blocks' as const, taskId: 'a' },
      { type: 'relates' as const, taskId: 'b' },
      { type: 'caused_by' as const, taskId: 'a' },
    ]
    expect(removeLinksTo(links, 'a')).toEqual([{ type: 'relates', taskId: 'b' }])
  })
})
