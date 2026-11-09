import { describe, expect, it } from 'vitest'
import { inputFromTemplate, subtaskInputs, templateFromData, templateFromTask } from './templates'
import { taskFromData } from './task'

const task = taskFromData('A', {
  key: 'EST-1',
  title: 'Revisión semanal',
  description: '- [ ] correo',
  priority: 'high',
  estimateMin: 60,
  tagIds: ['t1'],
  projectId: 'p1',
  startDate: '2026-11-09',
})

describe('plantillas (idea 9)', () => {
  it('se crean desde la tarea, sin proyecto ni fechas', () => {
    const tpl = templateFromTask(task, '  Semanal  ', [' Correo ', '', 'Agenda'])
    expect(tpl).toEqual({
      name: 'Semanal',
      title: 'Revisión semanal',
      description: '- [ ] correo',
      priority: 'high',
      estimateMin: 60,
      tagIds: ['t1'],
      subtasks: ['Correo', 'Agenda'],
    })
  })

  it('sin nombre, usa el título', () => {
    expect(templateFromTask(task, '   ', []).name).toBe('Revisión semanal')
  })

  it('al crear, el formulario manda en título, proyecto, fechas y prioridad', () => {
    const tpl = { id: 'x', ...templateFromTask(task, 'S', ['Correo']) }
    const input = inputFromTemplate(tpl, {
      title: 'Revisión del lunes',
      projectId: null,
      startDate: '2026-11-16',
      endDate: null,
      priority: 'low',
    })
    expect(input).toEqual({
      title: 'Revisión del lunes',
      projectId: null,
      startDate: '2026-11-16',
      endDate: null,
      priority: 'low',
      description: '- [ ] correo',
      estimateMin: 60,
      tagIds: ['t1'],
    })
    expect(subtaskInputs(tpl, { id: 'NEW', projectId: null, priority: 'low' })).toEqual([
      {
        title: 'Correo',
        projectId: null,
        startDate: null,
        endDate: null,
        priority: 'low',
        parentId: 'NEW',
      },
    ])
  })

  it('lee datos incompletos sin romperse', () => {
    expect(templateFromData('t', { name: 'X', priority: 'rara' })).toMatchObject({
      name: 'X',
      priority: 'medium',
      subtasks: [],
      estimateMin: null,
    })
  })
})
