import { describe, expect, it } from 'vitest'
import {
  formatMonthParam,
  gridRange,
  hiddenPerDay,
  ghostsOfDay,
  layoutWeek,
  monthGrid,
  moveDates,
  parseMonthParam,
  shiftMonth,
  tasksOfDay,
} from './calendar'
import { taskFromData, type Task } from './task'

function task(
  key: string,
  start: string | null,
  end: string | null = null,
  priority = 'medium',
): Task {
  return taskFromData(key, { key, startDate: start, endDate: end, priority })
}

describe('mes en la URL', () => {
  it('lee y escribe AAAA-MM', () => {
    const m = parseMonthParam('2026-11')
    expect([m.getFullYear(), m.getMonth(), m.getDate()]).toEqual([2026, 10, 1])
    expect(formatMonthParam(m)).toBe('2026-11')
  })

  it('con un valor raro usa el mes de la fecha de respaldo', () => {
    expect(formatMonthParam(parseMonthParam('2026-13', new Date(2026, 4, 20)))).toBe('2026-05')
    expect(formatMonthParam(parseMonthParam(undefined, new Date(2027, 0, 9)))).toBe('2027-01')
  })

  it('avanza y retrocede cruzando años', () => {
    expect(formatMonthParam(shiftMonth(new Date(2026, 11, 1), 1))).toBe('2027-01')
    expect(formatMonthParam(shiftMonth(new Date(2026, 0, 1), -1))).toBe('2025-12')
  })
})

describe('monthGrid', () => {
  it('noviembre de 2026 empieza en lunes 26 de octubre y tiene 6 semanas', () => {
    const weeks = monthGrid(new Date(2026, 10, 1))
    expect(weeks).toHaveLength(6)
    expect(weeks[0]![0]).toBe('2026-10-26')
    expect(weeks[5]![6]).toBe('2026-12-06')
    expect(gridRange(weeks)).toEqual({ from: '2026-10-26', to: '2026-12-06' })
  })

  it('febrero de 2027 cabe en 4 semanas exactas (empieza en lunes)', () => {
    const weeks = monthGrid(new Date(2027, 1, 1))
    expect(weeks).toHaveLength(4)
    expect(weeks[0]![0]).toBe('2027-02-01')
  })

  it('todas las semanas empiezan en lunes y no se repiten días', () => {
    const days = monthGrid(new Date(2026, 2, 1)).flat()
    expect(new Set(days).size).toBe(days.length)
  })
})

describe('layoutWeek (D-20)', () => {
  const week = [
    '2026-11-02',
    '2026-11-03',
    '2026-11-04',
    '2026-11-05',
    '2026-11-06',
    '2026-11-07',
    '2026-11-08',
  ]

  it('coloca cada tarea en sus columnas y corta en los bordes de la semana', () => {
    const segs = layoutWeek(week, [
      task('A', '2026-10-30', '2026-11-03'), // viene de la semana anterior
      task('B', '2026-11-05'),
      task('C', '2026-11-07', '2026-11-12'), // sigue en la siguiente
    ])
    expect(
      segs.map((s) => [s.task.key, s.col, s.span, s.continuesBefore, s.continuesAfter]),
    ).toEqual([
      ['A', 0, 2, true, false],
      ['B', 3, 1, false, false],
      ['C', 5, 2, false, true],
    ])
  })

  it('reparte en carriles las que se solapan y reaprovecha los huecos', () => {
    const segs = layoutWeek(week, [
      task('A', '2026-11-02', '2026-11-05'),
      task('B', '2026-11-03'),
      task('C', '2026-11-06'),
      task('D', '2026-11-03', '2026-11-04'),
    ])
    const lane = Object.fromEntries(segs.map((s) => [s.task.key, s.lane]))
    expect(lane).toEqual({ A: 0, D: 1, B: 2, C: 0 })
  })

  it('ignora las tareas sin fecha o de otras semanas', () => {
    expect(layoutWeek(week, [task('X', null), task('Y', '2026-11-20')])).toEqual([])
  })

  it('cuenta las ocultas por día y lista todas las del día', () => {
    const segs = layoutWeek(week, [
      task('A', '2026-11-04'),
      task('B', '2026-11-04'),
      task('C', '2026-11-04', '2026-11-05'),
      task('D', '2026-11-04', '2026-11-06'),
    ])
    // D (3 días) y C (2 días) ocupan los carriles 0 y 1; A y B, del día 4, quedan ocultas.
    expect(hiddenPerDay(segs, 2)).toEqual([0, 0, 2, 0, 0, 0, 0])
    expect(hiddenPerDay(segs, 1)).toEqual([0, 0, 3, 1, 0, 0, 0])
    expect(tasksOfDay('2026-11-04', segs).map((t) => t.key)).toEqual(['D', 'C', 'A', 'B'])
  })
})

describe('moveDates (D-21)', () => {
  it('mueve inicio y fin manteniendo la duración', () => {
    const t = task('A', '2026-11-03', '2026-11-05')
    expect(moveDates(t, '2026-11-03', '2026-11-10')).toEqual({
      startDate: '2026-11-10',
      endDate: '2026-11-12',
    })
  })

  it('respeta el día por el que se cogió la barra', () => {
    const t = task('A', '2026-11-03', '2026-11-05')
    // cogida por el día 5 y soltada en el 8: se mueve 3 días
    expect(moveDates(t, '2026-11-05', '2026-11-08')).toEqual({
      startDate: '2026-11-06',
      endDate: '2026-11-08',
    })
  })

  it('una tarea de un día sigue siendo de un día, también cruzando meses', () => {
    expect(moveDates(task('A', '2026-10-31'), '2026-10-31', '2026-11-02')).toEqual({
      startDate: '2026-11-02',
      endDate: null,
    })
  })

  it('una tarea sin fecha toma el día donde se suelta', () => {
    expect(moveDates(task('A', null), null, '2026-11-09')).toEqual({
      startDate: '2026-11-09',
      endDate: null,
    })
  })
})

describe('repeticiones fantasma en la semana (v1.2.0)', () => {
  const week = [
    '2026-11-02',
    '2026-11-03',
    '2026-11-04',
    '2026-11-05',
    '2026-11-06',
    '2026-11-07',
    '2026-11-08',
  ]

  it('van detrás de las reales: ocupan los huecos y nunca las desplazan', () => {
    const real = [task('A', '2026-11-02', '2026-11-04'), task('B', '2026-11-03')]
    const ghost = { ...task('G', '2026-11-03'), id: 'G~1' }
    const segs = layoutWeek(week, real, [ghost])
    const lane = (key: string) => segs.find((s) => s.task.key === key)!.lane
    expect(lane('A')).toBe(0)
    expect(lane('B')).toBe(1)
    expect(lane('G')).toBe(2)
    expect(segs.find((s) => s.task.key === 'G')!.ghost).toBe(true)
    expect(segs.find((s) => s.task.key === 'A')!.ghost).toBe(false)
  })

  it('en un día libre, la fantasma usa el primer carril', () => {
    const segs = layoutWeek(
      week,
      [task('A', '2026-11-02')],
      [{ ...task('G', '2026-11-05'), id: 'G~1' }],
    )
    expect(segs.find((s) => s.task.key === 'G')!.lane).toBe(0)
  })

  it('si no caben cuentan en «+N más» y salen aparte en la lista del día', () => {
    const real = [task('A', '2026-11-02')]
    const ghosts = [1, 2, 3].map((n) => ({ ...task(`G${n}`, '2026-11-02'), id: `G~${n}` }))
    const segs = layoutWeek(week, real, ghosts)
    expect(hiddenPerDay(segs, 3)[0]).toBe(1)
    expect(tasksOfDay('2026-11-02', segs).map((t) => t.key)).toEqual(['A'])
    expect(ghostsOfDay('2026-11-02', segs).map((t) => t.key)).toEqual(['G1', 'G2', 'G3'])
  })
})
