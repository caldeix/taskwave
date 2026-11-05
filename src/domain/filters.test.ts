import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  applyFilters,
  normalizeFilters,
  periodRange,
  sortTasks,
  type TaskFilters,
} from './filters'
import { taskFromData, type Task } from './task'

const TODAY = '2026-11-05' // jueves

function task(key: string, extra: Record<string, unknown> = {}): Task {
  return taskFromData(key, { key, ...extra })
}

const f = (patch: Partial<TaskFilters>): TaskFilters => ({ ...DEFAULT_FILTERS, ...patch })
const keys = (tasks: Task[]) => tasks.map((t) => t.key)

describe('normalizeFilters', () => {
  it('sin datos devuelve los filtros por defecto', () => {
    expect(normalizeFilters(null)).toEqual(DEFAULT_FILTERS)
    expect(normalizeFilters('basura')).toEqual(DEFAULT_FILTERS)
  })

  it('descarta valores desconocidos y duplicados', () => {
    expect(
      normalizeFilters({
        hiddenStatuses: ['done', 'done', 'archivada'],
        period: 'siglo',
        sort: 'end',
        tagIds: ['a', 'a', 3],
        priorities: ['high', 'urgente'],
        quick: 'overdue',
      }),
    ).toEqual({
      ...DEFAULT_FILTERS,
      hiddenStatuses: ['done'],
      sort: 'end',
      tagIds: ['a'],
      priorities: ['high'],
      quick: 'overdue',
    })
  })
})

describe('periodRange (semana de lunes a domingo)', () => {
  it('calcula hoy, semana, mes y año', () => {
    expect(periodRange('today', TODAY)).toEqual({ from: TODAY, to: TODAY })
    expect(periodRange('week', TODAY)).toEqual({ from: '2026-11-02', to: '2026-11-08' })
    expect(periodRange('month', TODAY)).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(periodRange('year', TODAY)).toEqual({ from: '2026-01-01', to: '2026-12-31' })
    expect(periodRange('all', TODAY)).toBeNull()
  })
})

describe('applyFilters', () => {
  const tasks = [
    task('A', { status: 'pending', priority: 'high', startDate: '2026-11-03', tagIds: ['uni'] }),
    task('B', { status: 'done', priority: 'low', startDate: '2026-10-20', endDate: '2026-11-02' }),
    task('C', {
      status: 'in_progress',
      priority: 'medium',
      startDate: '2026-12-10',
      tagIds: ['uni', 'urg'],
    }),
    task('D', { status: 'paused', priority: 'high', tagIds: ['urg'] }), // sin fecha
    task('E', { status: 'pending', priority: 'low', startDate: '2026-10-01' }), // atrasada
  ]
  const ctx = { today: TODAY }

  it('sin filtros pasan todas', () => {
    expect(keys(applyFilters(tasks, DEFAULT_FILTERS, ctx))).toEqual(['A', 'B', 'C', 'D', 'E'])
  })

  it('el ojo oculta estados', () => {
    expect(keys(applyFilters(tasks, f({ hiddenStatuses: ['done', 'paused'] }), ctx))).toEqual([
      'A',
      'C',
      'E',
    ])
  })

  it('periodo: entran las que se solapan; sin fecha no entran (D-37)', () => {
    expect(keys(applyFilters(tasks, f({ period: 'week' }), ctx))).toEqual(['A', 'B'])
    expect(keys(applyFilters(tasks, f({ period: 'month' }), ctx))).toEqual(['A', 'B'])
    expect(keys(applyFilters(tasks, f({ period: 'year' }), ctx))).toEqual(['A', 'B', 'C', 'E'])
  })

  it('en el calendario el periodo no se aplica (D-39)', () => {
    expect(
      keys(applyFilters(tasks, f({ period: 'today' }), { ...ctx, ignorePeriod: true })),
    ).toHaveLength(5)
  })

  it('tags: cualquiera (OR) o todas (AND) (D-40)', () => {
    expect(keys(applyFilters(tasks, f({ tagIds: ['uni', 'urg'] }), ctx))).toEqual(['A', 'C', 'D'])
    expect(keys(applyFilters(tasks, f({ tagIds: ['uni', 'urg'], tagMode: 'all' }), ctx))).toEqual([
      'C',
    ])
  })

  it('prioridad (D-51)', () => {
    expect(keys(applyFilters(tasks, f({ priorities: ['high'] }), ctx))).toEqual(['A', 'D'])
  })

  it('rápidos: atrasadas o sin fecha (el periodo no quita las sin fecha)', () => {
    // A empezó el 3 y no tiene fin: también está atrasada.
    expect(keys(applyFilters(tasks, f({ quick: 'overdue' }), ctx))).toEqual(['A', 'E'])
    expect(keys(applyFilters(tasks, f({ quick: 'undated', period: 'week' }), ctx))).toEqual(['D'])
  })
})

describe('sortTasks', () => {
  const tasks = [
    task('T-1', { startDate: '2026-11-10', endDate: '2026-11-20' }),
    task('T-2', { startDate: '2026-11-05' }),
    task('T-3', {}),
    task('T-4', { startDate: '2026-11-01', endDate: '2026-11-30' }),
  ]

  it('por defecto, el orden de D-35 (fin o inicio)', () => {
    expect(keys(sortTasks(tasks, 'due', 'asc'))).toEqual(['T-2', 'T-1', 'T-4', 'T-3'])
  })

  it('por inicio o por fin, y al revés; las que no tienen esa fecha al final', () => {
    expect(keys(sortTasks(tasks, 'start', 'asc'))).toEqual(['T-4', 'T-2', 'T-1', 'T-3'])
    expect(keys(sortTasks(tasks, 'start', 'desc'))).toEqual(['T-1', 'T-2', 'T-4', 'T-3'])
    expect(keys(sortTasks(tasks, 'end', 'asc'))).toEqual(['T-1', 'T-4', 'T-2', 'T-3'])
    expect(keys(sortTasks(tasks, 'due', 'desc'))).toEqual(['T-4', 'T-1', 'T-2', 'T-3'])
  })
})

describe('activeFilterCount', () => {
  it('cuenta los filtros activos, no el orden', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0)
    expect(activeFilterCount(f({ sort: 'end', sortDir: 'desc' }))).toBe(0)
    expect(activeFilterCount(f({ period: 'week', quick: 'overdue', tagIds: ['a'] }))).toBe(3)
  })
})
