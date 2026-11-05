import { describe, expect, it } from 'vitest'
import {
  closedSinceMs,
  groupByStatus,
  isOverdue,
  nextClosedWindow,
  sortColumn,
  statusChangePatch,
} from './kanban'
import { taskFromData, type Task } from './task'

const TODAY = '2026-11-05'

function task(key: string, extra: Record<string, unknown> = {}): Task {
  return taskFromData(key, { key, ...extra })
}

describe('isOverdue (D-35)', () => {
  it('abierta y con la fecha (fin o inicio) pasada', () => {
    expect(isOverdue(task('A', { startDate: '2026-11-01' }), TODAY)).toBe(true)
    expect(isOverdue(task('A', { startDate: '2026-11-01', endDate: '2026-11-07' }), TODAY)).toBe(
      false,
    )
    expect(isOverdue(task('A', { startDate: '2026-11-05' }), TODAY)).toBe(false)
    expect(isOverdue(task('A', {}), TODAY)).toBe(false)
  })

  it('las cerradas nunca están atrasadas (D-16)', () => {
    expect(isOverdue(task('A', { status: 'done', startDate: '2026-10-01' }), TODAY)).toBe(false)
    expect(isOverdue(task('A', { status: 'ko', startDate: '2026-10-01' }), TODAY)).toBe(false)
  })
})

describe('sortColumn (D-35)', () => {
  it('por fecha fin o inicio, de la más próxima a la más lejana; sin fecha al final', () => {
    const sorted = sortColumn([
      task('EST-5', {}),
      task('EST-4', { startDate: '2026-11-20' }),
      task('EST-3', { startDate: '2026-11-01', endDate: '2026-11-10' }),
      task('EST-2', { startDate: '2026-10-28' }), // atrasada: arriba
      task('EST-10', {}),
      task('EST-1', { startDate: '2026-11-10' }), // misma fecha que EST-3: desempata la clave
    ])
    expect(sorted.map((t) => t.key)).toEqual([
      'EST-2',
      'EST-1',
      'EST-3',
      'EST-4',
      'EST-5',
      'EST-10',
    ])
  })
})

describe('groupByStatus', () => {
  it('reparte en las 6 columnas', () => {
    const columns = groupByStatus([
      task('A', { status: 'done' }),
      task('B', { status: 'pending' }),
      task('C', { status: 'pending' }),
    ])
    expect(Object.keys(columns)).toEqual([
      'pending',
      'in_progress',
      'paused',
      'done',
      'discarded',
      'ko',
    ])
    expect(columns.pending.map((t) => t.key)).toEqual(['B', 'C'])
    expect(columns.done).toHaveLength(1)
    expect(columns.ko).toEqual([])
  })
})

describe('statusChangePatch (D-17)', () => {
  it('al cerrar guarda cuándo y pone hoy como fecha fin si no tenía', () => {
    expect(statusChangePatch(task('A', { startDate: '2026-11-01' }), 'done', TODAY)).toEqual({
      status: 'done',
      resolvedAt: 'now',
      endDate: TODAY,
    })
  })

  it('al cerrar respeta la fecha fin que ya tenía', () => {
    expect(
      statusChangePatch(task('A', { startDate: '2026-11-01', endDate: '2026-11-03' }), 'ko', TODAY),
    ).toEqual({ status: 'ko', resolvedAt: 'now' })
  })

  it('una tarea de hoy sigue siendo de un día', () => {
    expect(statusChangePatch(task('A', { startDate: TODAY }), 'done', TODAY)).toEqual({
      status: 'done',
      resolvedAt: 'now',
    })
  })

  it('sin fecha, al cerrarla pasa a ser de hoy', () => {
    expect(statusChangePatch(task('A', {}), 'discarded', TODAY)).toEqual({
      status: 'discarded',
      resolvedAt: 'now',
      startDate: TODAY,
      endDate: null,
    })
  })

  it('si empieza en el futuro no se tocan sus fechas (el fin no puede ser anterior)', () => {
    expect(statusChangePatch(task('A', { startDate: '2026-12-01' }), 'done', TODAY)).toEqual({
      status: 'done',
      resolvedAt: 'now',
    })
  })

  it('al reabrir borra cuándo se cerró; entre abiertos o entre cerrados solo cambia el estado', () => {
    expect(statusChangePatch(task('A', { status: 'done' }), 'in_progress', TODAY)).toEqual({
      status: 'in_progress',
      resolvedAt: null,
    })
    expect(statusChangePatch(task('A', { status: 'pending' }), 'paused', TODAY)).toEqual({
      status: 'paused',
    })
    expect(statusChangePatch(task('A', { status: 'done' }), 'ko', TODAY)).toEqual({ status: 'ko' })
  })
})

describe('ventana de las columnas cerradas (D-36)', () => {
  it('30 → 90 → 365 → todas', () => {
    expect(nextClosedWindow(30)).toBe(90)
    expect(nextClosedWindow(90)).toBe(365)
    expect(nextClosedWindow(365)).toBeNull()
    expect(nextClosedWindow(null)).toBeNull()
  })

  it('calcula desde cuándo leer', () => {
    const now = Date.UTC(2026, 10, 5)
    expect(closedSinceMs(30, now)).toBe(Date.UTC(2026, 9, 6))
    expect(closedSinceMs(null, now)).toBe(0)
  })
})
