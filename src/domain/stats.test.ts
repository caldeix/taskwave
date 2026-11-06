import { describe, expect, it } from 'vitest'
import {
  estimateAccuracy,
  heatmap,
  minutesByDay,
  minutesByProject,
  minutesByTag,
  minutesByWeek,
  minutesPerDay,
  rangeLength,
  shiftAnchor,
  statsRange,
  summarize,
} from './stats'
import type { Worklog } from './worklog'

const log = (
  taskId: string,
  date: string,
  minutes: number,
  projectId: string | null = 'p1',
): Worklog => ({
  id: `${taskId}-${date}-${minutes}`,
  taskId,
  projectId,
  date,
  minutes,
  startedAtMs: null,
  endedAtMs: null,
  source: 'manual',
  note: '',
})

const logs = [
  log('A', '2026-11-02', 60),
  log('A', '2026-11-02', 30),
  log('B', '2026-11-04', 120, 'p2'),
  log('C', '2026-11-09', 45, null),
]

describe('periodos', () => {
  it('semana de lunes a domingo, mes, últimos 30 días y año', () => {
    expect(statsRange('week', '2026-11-06')).toEqual({ from: '2026-11-02', to: '2026-11-08' })
    expect(statsRange('month', '2026-11-06')).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(statsRange('last30', '2026-11-06')).toEqual({ from: '2026-10-08', to: '2026-11-06' })
    expect(statsRange('year', '2026-11-06')).toEqual({ from: '2026-01-01', to: '2026-12-31' })
    expect(rangeLength(statsRange('last30', '2026-11-06'))).toBe(30)
  })

  it('se mueve atrás y adelante', () => {
    expect(shiftAnchor('week', '2026-11-06', -1)).toBe('2026-10-30')
    expect(shiftAnchor('month', '2026-01-31', 1)).toBe('2026-02-28')
    expect(shiftAnchor('year', '2026-11-06', -1)).toBe('2025-11-06')
    expect(shiftAnchor('last30', '2026-11-06', -1)).toBe('2026-10-07')
  })
})

describe('resumen, días y semanas', () => {
  it('total, días trabajados, media por día trabajado y tareas', () => {
    expect(summarize(logs)).toEqual({
      totalMin: 255,
      daysWorked: 3,
      avgPerWorkedDayMin: 85,
      tasksWorked: 3,
    })
    expect(summarize([])).toEqual({
      totalMin: 0,
      daysWorked: 0,
      avgPerWorkedDayMin: 0,
      tasksWorked: 0,
    })
  })

  it('cada día del rango, también los vacíos', () => {
    const days = minutesByDay(logs, { from: '2026-11-01', to: '2026-11-04' })
    expect(days).toEqual([
      { key: '2026-11-01', minutes: 0 },
      { key: '2026-11-02', minutes: 90 },
      { key: '2026-11-03', minutes: 0 },
      { key: '2026-11-04', minutes: 120 },
    ])
  })

  it('semanas por su lunes, incluida la que empieza antes del rango', () => {
    expect(minutesByWeek(logs, { from: '2026-11-01', to: '2026-11-10' })).toEqual([
      { key: '2026-10-26', minutes: 0 },
      { key: '2026-11-02', minutes: 210 },
      { key: '2026-11-09', minutes: 45 },
    ])
  })
})

describe('por proyecto y por tag', () => {
  it('de más a menos, con «sin proyecto» como null', () => {
    expect(minutesByProject(logs)).toEqual([
      { id: 'p2', minutes: 120 },
      { id: 'p1', minutes: 90 },
      { id: null, minutes: 45 },
    ])
  })

  it('una tarea con varios tags cuenta en cada uno; sin tags o desconocida, «sin tag»', () => {
    const tasks = new Map([
      ['A', { tagIds: ['uni', 'urg'] }],
      ['B', { tagIds: ['uni'] }],
      ['C', { tagIds: [] }],
    ])
    expect(minutesByTag([...logs, log('X', '2026-11-05', 10)], tasks)).toEqual([
      { id: 'uni', minutes: 210 },
      { id: 'urg', minutes: 90 },
      { id: null, minutes: 55 },
    ])
  })
})

describe('heatmap', () => {
  it('semanas de lunes a domingo con niveles relativos al día con más horas', () => {
    // 2026-11-04 es miércoles: dos huecos delante.
    const weeks = heatmap([
      { key: '2026-11-04', minutes: 0 },
      { key: '2026-11-05', minutes: 30 },
      { key: '2026-11-06', minutes: 120 },
    ])
    expect(weeks).toHaveLength(1)
    expect(weeks[0]!.map((c) => c?.level ?? null)).toEqual([null, null, 0, 1, 4, null, null])
    expect(heatmap([])).toEqual([])
  })
})

describe('estimateAccuracy (D-31)', () => {
  const t = (key: string, estimateMin: number | null, spentMin: number, status = 'done') => ({
    id: key,
    key,
    title: key,
    estimateMin,
    spentMin,
    status: status as 'done',
  })

  it('desviación de cada tarea, media en valor absoluto y del total', () => {
    const acc = estimateAccuracy([
      t('A', 100, 150), // +50 %
      t('B', 200, 100), // −50 %
      t('C', 100, 105), // +5 %: en lo estimado
      t('D', null, 300), // sin estimado: no cuenta
      t('E', 100, 500, 'discarded'), // descartada: no cuenta
    ])
    expect(acc.rows.map((r) => [r.task.key, r.deviationPct])).toEqual([
      ['A', 50],
      ['B', -50],
      ['C', 5],
    ])
    expect(acc).toMatchObject({ meanAbsPct: 35, totalPct: -11, over: 1, under: 1, onTarget: 1 })
  })

  it('sin tareas con estimado no hay medias', () => {
    expect(estimateAccuracy([t('D', null, 30)])).toMatchObject({ rows: [], meanAbsPct: null })
  })
})

describe('minutesPerDay (horas de cada día del calendario)', () => {
  it('suma por día dentro del ámbito de la vista', () => {
    expect(minutesPerDay(logs, { kind: 'all' })).toEqual({
      '2026-11-02': 90,
      '2026-11-04': 120,
      '2026-11-09': 45,
    })
    expect(minutesPerDay(logs, { kind: 'project', projectId: 'p2' })).toEqual({ '2026-11-04': 120 })
    expect(minutesPerDay(logs, { kind: 'inbox' })).toEqual({ '2026-11-09': 45 })
  })
})
