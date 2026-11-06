import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  startOfWeek,
} from 'date-fns'
import { addDaysToKey, fromDayKey, toDayKey, type DayKey, type DayRange } from './dates'
import { periodRange } from './filters'
import type { Task } from './task'
import type { Worklog } from './worklog'

/**
 * Estadísticas (step-23, D-55, CA-17): horas por día, semana, proyecto y tag del periodo, mapa
 * de calor y acierto de las estimaciones. Todo se calcula aquí, en puro, a partir de los
 * registros de horas del periodo y de las tareas cerradas en él.
 */

export const STATS_PERIODS = ['week', 'month', 'last30', 'year'] as const
export type StatsPeriod = (typeof STATS_PERIODS)[number]

/** Rango del periodo que contiene `anchor` (semanas de lunes a domingo). */
export function statsRange(period: StatsPeriod, anchor: DayKey): DayRange {
  if (period === 'last30') return { from: addDaysToKey(anchor, -29), to: anchor }
  return periodRange(period, anchor)!
}

/** Mueve el periodo uno atrás (-1) o adelante (+1). */
export function shiftAnchor(period: StatsPeriod, anchor: DayKey, step: -1 | 1): DayKey {
  const d = fromDayKey(anchor)
  if (period === 'week') return toDayKey(addWeeks(d, step))
  if (period === 'month') return toDayKey(addMonths(d, step))
  if (period === 'year') return toDayKey(addYears(d, step))
  return toDayKey(addDays(d, step * 30))
}

export function daysIn(range: DayRange): DayKey[] {
  const days: DayKey[] = []
  for (let d = range.from; d <= range.to; d = addDaysToKey(d, 1)) days.push(d)
  return days
}

// ---------------------------------------------------------------- resumen

export interface StatsSummary {
  totalMin: number
  daysWorked: number
  /** Media por día trabajado (no por día del periodo). */
  avgPerWorkedDayMin: number
  tasksWorked: number
}

export function summarize(logs: Worklog[]): StatsSummary {
  const days = new Set(logs.map((l) => l.date))
  const totalMin = logs.reduce((sum, l) => sum + l.minutes, 0)
  return {
    totalMin,
    daysWorked: days.size,
    avgPerWorkedDayMin: days.size ? Math.round(totalMin / days.size) : 0,
    tasksWorked: new Set(logs.map((l) => l.taskId)).size,
  }
}

// ---------------------------------------------------------------- por día y semana

export interface Bucket {
  key: DayKey
  minutes: number
}

/** Minutos de cada día del rango, también los días sin horas (a cero). */
export function minutesByDay(logs: Worklog[], range: DayRange): Bucket[] {
  const byDay = new Map<DayKey, number>()
  for (const l of logs) byDay.set(l.date, (byDay.get(l.date) ?? 0) + l.minutes)
  return daysIn(range).map((key) => ({ key, minutes: byDay.get(key) ?? 0 }))
}

/** Minutos de cada semana (clave = su lunes) que toca el rango. */
export function minutesByWeek(logs: Worklog[], range: DayRange): Bucket[] {
  const monday = (day: DayKey) => toDayKey(startOfWeek(fromDayKey(day), { weekStartsOn: 1 }))
  const weeks = new Map<DayKey, number>()
  for (let w = monday(range.from); w <= range.to; w = addDaysToKey(w, 7)) weeks.set(w, 0)
  for (const l of logs) {
    const w = monday(l.date)
    if (weeks.has(w)) weeks.set(w, weeks.get(w)! + l.minutes)
  }
  return [...weeks].map(([key, minutes]) => ({ key, minutes }))
}

// ---------------------------------------------------------------- por proyecto y por tag

export interface Share {
  /** Id del proyecto o del tag; `null` = sin proyecto / sin tag. */
  id: string | null
  minutes: number
}

function ranked(map: Map<string | null, number>): Share[] {
  return [...map]
    .map(([id, minutes]) => ({ id, minutes }))
    .filter((s) => s.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes || String(a.id).localeCompare(String(b.id)))
}

/** Horas por proyecto, de más a menos (el proyecto va guardado en cada registro). */
export function minutesByProject(logs: Worklog[]): Share[] {
  const map = new Map<string | null, number>()
  for (const l of logs) map.set(l.projectId, (map.get(l.projectId) ?? 0) + l.minutes)
  return ranked(map)
}

/**
 * Horas por tag, de más a menos. Una tarea con varios tags cuenta en cada uno (la suma puede
 * pasar del total); sin tags, va a «sin tag». Si no se conoce la tarea, también.
 */
export function minutesByTag(logs: Worklog[], tasks: Map<string, Pick<Task, 'tagIds'>>): Share[] {
  const map = new Map<string | null, number>()
  for (const l of logs) {
    const tagIds = tasks.get(l.taskId)?.tagIds ?? []
    const keys = tagIds.length ? [...new Set(tagIds)] : [null]
    for (const k of keys) map.set(k, (map.get(k) ?? 0) + l.minutes)
  }
  return ranked(map)
}

// ---------------------------------------------------------------- mapa de calor

export interface HeatCell {
  date: DayKey
  minutes: number
  /** 0 = sin horas; 1 a 4 = cuartos del día con más horas del periodo. */
  level: 0 | 1 | 2 | 3 | 4
}

/**
 * Mapa de calor por semanas (columnas) y días de lunes a domingo (filas). Las casillas fuera del
 * rango son `null`. El nivel es relativo al día con más horas del periodo.
 */
export function heatmap(days: Bucket[]): (HeatCell | null)[][] {
  if (!days.length) return []
  const max = Math.max(...days.map((d) => d.minutes))
  const first = fromDayKey(days[0]!.key)
  const offset = (first.getDay() + 6) % 7 // lunes = 0
  const cells: (HeatCell | null)[] = Array.from({ length: offset }, () => null)
  for (const d of days) {
    const level = d.minutes === 0 || max === 0 ? 0 : Math.max(1, Math.ceil((d.minutes / max) * 4))
    cells.push({ date: d.key, minutes: d.minutes, level: level as HeatCell['level'] })
  }
  while (cells.length % 7) cells.push(null)
  const weeks: (HeatCell | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

// ---------------------------------------------------------------- acierto de las estimaciones

export interface AccuracyRow {
  task: Pick<Task, 'id' | 'key' | 'title' | 'estimateMin' | 'spentMin'>
  estimateMin: number
  spentMin: number
  /** (gastado − estimado) / estimado, en %: positivo = se pasó, negativo = sobró. */
  deviationPct: number
}

export interface Accuracy {
  rows: AccuracyRow[]
  /** Media de las desviaciones en valor absoluto (lo que se suele fallar), en %. */
  meanAbsPct: number | null
  /** Desviación del total: (Σ gastado − Σ estimado) / Σ estimado, en %. */
  totalPct: number | null
  over: number
  under: number
  onTarget: number
}

/** Margen para contar una tarea como «en lo estimado» (±10 %). */
export const ON_TARGET_PCT = 10

/**
 * Acierto de las estimaciones de las tareas cerradas en el periodo con estimado (D-31): cuánto
 * se pasaron o sobró. Las descartadas no cuentan (no se terminaron).
 */
export function estimateAccuracy(
  tasks: Pick<Task, 'id' | 'key' | 'title' | 'estimateMin' | 'spentMin' | 'status'>[],
): Accuracy {
  const rows = tasks
    .filter((t) => t.status !== 'discarded' && t.estimateMin && t.estimateMin > 0)
    .map((task) => ({
      task,
      estimateMin: task.estimateMin!,
      spentMin: task.spentMin,
      deviationPct: Math.round(((task.spentMin - task.estimateMin!) / task.estimateMin!) * 100),
    }))
    .sort((a, b) => Math.abs(b.deviationPct) - Math.abs(a.deviationPct))
  if (!rows.length)
    return { rows, meanAbsPct: null, totalPct: null, over: 0, under: 0, onTarget: 0 }
  const est = rows.reduce((s, r) => s + r.estimateMin, 0)
  const spent = rows.reduce((s, r) => s + r.spentMin, 0)
  return {
    rows,
    meanAbsPct: Math.round(rows.reduce((s, r) => s + Math.abs(r.deviationPct), 0) / rows.length),
    totalPct: Math.round(((spent - est) / est) * 100),
    over: rows.filter((r) => r.deviationPct > ON_TARGET_PCT).length,
    under: rows.filter((r) => r.deviationPct < -ON_TARGET_PCT).length,
    onTarget: rows.filter((r) => Math.abs(r.deviationPct) <= ON_TARGET_PCT).length,
  }
}

/** Días del periodo (para decidir si se muestra por día o solo por semana). */
export function rangeLength(range: DayRange): number {
  return differenceInCalendarDays(fromDayKey(range.to), fromDayKey(range.from)) + 1
}

/**
 * Minutos de cada día con horas, solo de los registros del ámbito de la vista (todos, la bandeja
 * o un proyecto): las horas de cada día del calendario (step-24, D-52).
 */
export function minutesPerDay(
  logs: Worklog[],
  scope: { kind: 'all' } | { kind: 'inbox' } | { kind: 'project'; projectId: string },
): Record<DayKey, number> {
  const out: Record<DayKey, number> = {}
  for (const l of logs) {
    if (scope.kind === 'inbox' && l.projectId !== null) continue
    if (scope.kind === 'project' && l.projectId !== scope.projectId) continue
    out[l.date] = (out[l.date] ?? 0) + l.minutes
  }
  return out
}
