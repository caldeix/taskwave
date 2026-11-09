import { describe, expect, it } from 'vitest'
import { agendaDays } from './agenda'
import { taskFromData, type Task } from './task'

function task(key: string, extra: Record<string, unknown> = {}): Task {
  return taskFromData(key, { key, priority: 'medium', ...extra })
}

const NOV = new Date(2026, 10, 1)

describe('agendaDays (D-24)', () => {
  it('lista los días del mes con tareas u horas, y hoy, en orden', () => {
    const days = agendaDays(
      NOV,
      [task('EST-1', { startDate: '2026-11-10' }), task('EST-2', { startDate: '2026-11-03' })],
      '2026-11-07',
      { '2026-11-05': 90, '2026-11-20': 0, '2026-12-01': 30 },
    )
    expect(days.map((d) => [d.date, d.tasks.map((t) => t.key), d.minutes, d.isToday])).toEqual([
      ['2026-11-03', ['EST-2'], 0, false],
      ['2026-11-05', [], 90, false],
      ['2026-11-07', [], 0, true],
      ['2026-11-10', ['EST-1'], 0, false],
    ])
  })

  it('una tarea de varios días sale en cada día, recortada al mes', () => {
    const days = agendaDays(
      NOV,
      [task('EST-1', { startDate: '2026-10-30', endDate: '2026-11-02' })],
      '2026-12-15',
    )
    expect(days.map((d) => d.date)).toEqual(['2026-11-01', '2026-11-02'])
  })

  it('dentro del día, por prioridad y clave; sin fecha no salen', () => {
    const days = agendaDays(
      NOV,
      [
        task('EST-10', { startDate: '2026-11-04' }),
        task('EST-9', { startDate: '2026-11-04', priority: 'low' }),
        task('EST-2', { startDate: '2026-11-04', priority: 'high' }),
        task('EST-3'),
      ],
      '2026-12-01',
    )
    expect(days).toHaveLength(1)
    expect(days[0]!.tasks.map((t) => t.key)).toEqual(['EST-2', 'EST-10', 'EST-9'])
  })
})

describe('repeticiones fantasma en la agenda (v1.2.0)', () => {
  it('van aparte y un día solo con fantasmas también sale', () => {
    const month = new Date(2026, 10, 1)
    const real = taskFromData('A', { key: 'EST-1', startDate: '2026-11-09' })
    const ghost = { ...real, id: 'A~1', startDate: '2026-11-16' }
    const days = agendaDays(month, [real], '2026-11-09', {}, [ghost])
    expect(days.map((d) => d.date)).toEqual(['2026-11-09', '2026-11-16'])
    expect(days[1]!.tasks).toEqual([])
    expect(days[1]!.ghosts.map((g) => g.id)).toEqual(['A~1'])
  })
})
