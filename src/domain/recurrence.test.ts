import { describe, expect, it } from 'vitest'
import {
  nextDates,
  nextOccurrenceInput,
  parseRecurrenceId,
  recurrenceId,
  shiftDay,
  uncheckAll,
} from './recurrence'
import { taskFromData } from './task'

const TODAY = '2026-11-09'

describe('shiftDay', () => {
  it('desplaza días, semanas, meses y años', () => {
    expect(shiftDay('2026-11-09', { freq: 'day', interval: 3 })).toBe('2026-11-12')
    expect(shiftDay('2026-11-09', { freq: 'week', interval: 2 })).toBe('2026-11-23')
    expect(shiftDay('2026-01-31', { freq: 'month', interval: 1 })).toBe('2026-02-28')
    expect(shiftDay('2028-02-29', { freq: 'year', interval: 1 })).toBe('2029-02-28')
  })
})

describe('nextDates (idea 9)', () => {
  const weekly = { freq: 'week', interval: 1 } as const

  it('conserva la duración', () => {
    expect(nextDates({ startDate: '2026-11-09', endDate: '2026-11-11' }, weekly, TODAY)).toEqual({
      startDate: '2026-11-16',
      endDate: '2026-11-18',
    })
  })

  it('sin fechas, desde hoy; solo con fin, desde el fin', () => {
    expect(nextDates({ startDate: null, endDate: null }, weekly, TODAY)).toEqual({
      startDate: '2026-11-16',
      endDate: null,
    })
    expect(nextDates({ startDate: null, endDate: '2026-11-01' }, weekly, TODAY)).toEqual({
      startDate: '2026-11-08',
      endDate: null,
    })
  })
})

describe('nextOccurrenceInput', () => {
  it('copia la tarea con la descripción sin marcar y la recurrencia', () => {
    const task = taskFromData('A', {
      key: 'EST-1',
      title: 'Revisión semanal',
      projectId: 'p1',
      startDate: TODAY,
      priority: 'high',
      description: '- [x] correo\n- [ ] agenda',
      tagIds: ['t1'],
      recurrence: { freq: 'week', interval: 1 },
      spentMin: 90,
    })
    const input = nextOccurrenceInput(task, TODAY)!
    expect(input).toMatchObject({
      title: 'Revisión semanal',
      projectId: 'p1',
      startDate: '2026-11-16',
      priority: 'high',
      description: '- [ ] correo\n- [ ] agenda',
      tagIds: ['t1'],
      recurrence: { freq: 'week', interval: 1 },
    })
  })

  it('sin recurrencia no hay siguiente', () => {
    expect(nextOccurrenceInput(taskFromData('A', { key: 'EST-1' }), TODAY)).toBeNull()
  })
})

describe('uncheckAll y los identificadores del selector', () => {
  it('desmarca todas las casillas', () => {
    expect(uncheckAll('- [x] a\n  * [X] b\n1. [x] c\n- [ ] d')).toBe(
      '- [ ] a\n  * [ ] b\n1. [ ] c\n- [ ] d',
    )
  })

  it('ida y vuelta entre la recurrencia y su opción', () => {
    expect(recurrenceId({ freq: 'week', interval: 2 })).toBe('week:2')
    expect(parseRecurrenceId('week:2')).toEqual({ freq: 'week', interval: 2 })
    expect(parseRecurrenceId('')).toBeNull()
    expect(recurrenceId(null)).toBe('')
  })
})
