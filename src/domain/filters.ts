import { endOfMonth, endOfWeek, endOfYear, startOfMonth, startOfWeek, startOfYear } from 'date-fns'
import { fromDayKey, overlaps, toDayKey, type DayKey, type DayRange } from './dates'
import { dueDate, isOverdue, sortColumn } from './kanban'
import { TASK_STATUSES, type TaskStatus } from './status'
import { PRIORITIES, type Priority, type Task } from './task'

/**
 * Filtros de la vista principal (step-13, D-37, D-38, D-39, D-40, D-51). Se guardan en
 * `users/{uid}.prefs.filters` y son los mismos en todos los proyectos.
 */

export const PERIODS = ['all', 'today', 'week', 'month', 'year'] as const
export type Period = (typeof PERIODS)[number]

export const SORTS = ['due', 'start', 'end'] as const
export type SortField = (typeof SORTS)[number]

export const QUICK_FILTERS = ['none', 'overdue', 'undated'] as const
export type QuickFilter = (typeof QUICK_FILTERS)[number]

export interface TaskFilters {
  /** Estados ocultos con el ojo (columnas del kanban y barras del calendario). */
  hiddenStatuses: TaskStatus[]
  period: Period
  sort: SortField
  sortDir: 'asc' | 'desc'
  /** Tags a mostrar; vacío = sin filtro de tags. */
  tagIds: string[]
  /** «Cualquiera» (OR) o «todas» (AND) de los tags elegidos (D-40). */
  tagMode: 'any' | 'all'
  /** Prioridades a mostrar; vacío = todas. */
  priorities: Priority[]
  quick: QuickFilter
}

export const DEFAULT_FILTERS: TaskFilters = {
  hiddenStatuses: [],
  period: 'all',
  sort: 'due',
  sortDir: 'asc',
  tagIds: [],
  tagMode: 'any',
  priorities: [],
  quick: 'none',
}

const MAX_TAG_FILTERS = 20

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

function pickList<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  return Array.isArray(value) ? [...new Set(value.filter((v): v is T => allowed.includes(v)))] : []
}

/**
 * Filtros guardados → filtros válidos. Lo que venga de Firestore (u otra versión de la app)
 * se sanea: lo desconocido toma el valor por defecto.
 */
export function normalizeFilters(raw: unknown): TaskFilters {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    hiddenStatuses: pickList(r.hiddenStatuses, TASK_STATUSES),
    period: pick(r.period, PERIODS, 'all'),
    sort: pick(r.sort, SORTS, 'due'),
    sortDir: pick(r.sortDir, ['asc', 'desc'] as const, 'asc'),
    tagIds: Array.isArray(r.tagIds)
      ? [...new Set(r.tagIds.filter((v): v is string => typeof v === 'string'))].slice(
          0,
          MAX_TAG_FILTERS,
        )
      : [],
    tagMode: pick(r.tagMode, ['any', 'all'] as const, 'any'),
    priorities: pickList(r.priorities, PRIORITIES),
    quick: pick(r.quick, QUICK_FILTERS, 'none'),
  }
}

/** Rango de días de un periodo (semana de lunes a domingo). `null` = sin límite. */
export function periodRange(period: Period, today: DayKey): DayRange | null {
  const d = fromDayKey(today)
  switch (period) {
    case 'today':
      return { from: today, to: today }
    case 'week':
      return {
        from: toDayKey(startOfWeek(d, { weekStartsOn: 1 })),
        to: toDayKey(endOfWeek(d, { weekStartsOn: 1 })),
      }
    case 'month':
      return { from: toDayKey(startOfMonth(d)), to: toDayKey(endOfMonth(d)) }
    case 'year':
      return { from: toDayKey(startOfYear(d)), to: toDayKey(endOfYear(d)) }
    default:
      return null
  }
}

export interface FilterContext {
  today: DayKey
  /** En el calendario, el periodo lo marca el mes visible (D-39). */
  ignorePeriod?: boolean
}

/** ¿Pasa la tarea los filtros? */
export function matchesFilters(task: Task, filters: TaskFilters, ctx: FilterContext): boolean {
  if (filters.hiddenStatuses.includes(task.status)) return false
  if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) return false
  if (filters.tagIds.length > 0) {
    const has = (id: string) => task.tagIds.includes(id)
    const ok = filters.tagMode === 'all' ? filters.tagIds.every(has) : filters.tagIds.some(has)
    if (!ok) return false
  }
  if (filters.quick === 'overdue' && !isOverdue(task, ctx.today)) return false
  if (filters.quick === 'undated' && task.startDate !== null) return false
  if (!ctx.ignorePeriod && filters.quick !== 'undated') {
    const range = periodRange(filters.period, ctx.today)
    if (range && !overlaps(task.startDate, task.endDate, range)) return false
  }
  return true
}

export function applyFilters(tasks: Task[], filters: TaskFilters, ctx: FilterContext): Task[] {
  return tasks.filter((task) => matchesFilters(task, filters, ctx))
}

/**
 * Orden de las columnas del kanban. `due` es el de D-35 (fin o inicio); `start` y `end` usan
 * solo esa fecha. Las tareas sin la fecha elegida van siempre al final; empates por clave.
 */
export function sortTasks(tasks: Task[], sort: SortField, dir: 'asc' | 'desc'): Task[] {
  if (sort === 'due' && dir === 'asc') return sortColumn(tasks)
  const field = (t: Task): DayKey | null =>
    sort === 'start' ? t.startDate : sort === 'end' ? t.endDate : dueDate(t)
  const sign = dir === 'asc' ? 1 : -1
  return [...tasks].sort((a, b) => {
    const fa = field(a)
    const fb = field(b)
    if (fa !== fb) {
      if (fa === null) return 1
      if (fb === null) return -1
      return (fa < fb ? -1 : 1) * sign
    }
    return a.key.localeCompare(b.key, 'es', { numeric: true })
  })
}

/** Número de filtros activos (para el indicador de la barra). El orden no cuenta. */
export function activeFilterCount(filters: TaskFilters): number {
  return (
    (filters.hiddenStatuses.length > 0 ? 1 : 0) +
    (filters.period !== 'all' ? 1 : 0) +
    (filters.tagIds.length > 0 ? 1 : 0) +
    (filters.priorities.length > 0 ? 1 : 0) +
    (filters.quick !== 'none' ? 1 : 0)
  )
}
