import { addDaysToKey, isDayKey, type DayKey } from '@/domain/dates'
import { formatDuration, parseDuration } from '@/domain/duration'
import type { RelationKind } from '@/domain/links'
import type { Project } from '@/domain/projects'
import { TASK_STATUSES, type TaskStatus } from '@/domain/status'
import { findTagByName } from '@/domain/tags'
import type { Tag } from '@/domain/tags'
import { fold } from '@/domain/text'
import { PRIORITIES, type Priority, type Recurrence, type Task } from '@/domain/task'

/**
 * Traducción entre lo que pide Claude por la API de automatización (v1.3.0) y lo que espera la
 * app: estados, prioridades, recurrencias y tipos de vínculo en español o en inglés, fechas como
 * «hoy» o «mañana», proyectos y tags por nombre o clave, y tareas como un resumen plano.
 * Lógica pura: los errores son `Error` con un mensaje en español para devolver tal cual.
 */

const STATUS_ALIASES: Record<string, TaskStatus> = {
  pendiente: 'pending',
  'por hacer': 'pending',
  todo: 'pending',
  'en curso': 'in_progress',
  'en progreso': 'in_progress',
  doing: 'in_progress',
  paralizada: 'paused',
  pausada: 'paused',
  parada: 'paused',
  bloqueada: 'paused',
  realizada: 'done',
  hecha: 'done',
  terminada: 'done',
  cerrada: 'done',
  descartada: 'discarded',
  cancelada: 'discarded',
  ko: 'ko',
  fallida: 'ko',
}

export function normalizeStatus(value: unknown): TaskStatus {
  const text = fold(String(value ?? ''))
    .replace(/_/g, ' ')
    .trim()
  const direct = TASK_STATUSES.find((s) => s.replace(/_/g, ' ') === text)
  const status = direct ?? STATUS_ALIASES[text]
  if (!status)
    throw new Error(
      `Estado desconocido: «${String(value)}». Usa pendiente, en curso, paralizada, realizada, descartada o ko.`,
    )
  return status
}

const PRIORITY_ALIASES: Record<string, Priority> = {
  alta: 'high',
  urgente: 'high',
  media: 'medium',
  normal: 'medium',
  baja: 'low',
}

export function normalizePriority(value: unknown): Priority {
  const text = fold(String(value ?? '')).trim()
  const priority = PRIORITIES.find((p) => p === text) ?? PRIORITY_ALIASES[text]
  if (!priority)
    throw new Error(`Prioridad desconocida: «${String(value)}». Usa alta, media o baja.`)
  return priority
}

const RECURRENCE_ALIASES: Record<string, Recurrence | null> = {
  none: null,
  no: null,
  nunca: null,
  ninguna: null,
  day: { freq: 'day', interval: 1 },
  daily: { freq: 'day', interval: 1 },
  diaria: { freq: 'day', interval: 1 },
  'cada dia': { freq: 'day', interval: 1 },
  week: { freq: 'week', interval: 1 },
  weekly: { freq: 'week', interval: 1 },
  semanal: { freq: 'week', interval: 1 },
  'cada semana': { freq: 'week', interval: 1 },
  '2weeks': { freq: 'week', interval: 2 },
  quincenal: { freq: 'week', interval: 2 },
  'cada 2 semanas': { freq: 'week', interval: 2 },
  month: { freq: 'month', interval: 1 },
  monthly: { freq: 'month', interval: 1 },
  mensual: { freq: 'month', interval: 1 },
  'cada mes': { freq: 'month', interval: 1 },
  year: { freq: 'year', interval: 1 },
  yearly: { freq: 'year', interval: 1 },
  anual: { freq: 'year', interval: 1 },
  'cada año': { freq: 'year', interval: 1 },
  'cada ano': { freq: 'year', interval: 1 },
}

/** Recurrencia por nombre («semanal», «2weeks»…) u objeto `{ freq, interval }`; `null` la quita. */
export function normalizeRecurrence(value: unknown): Recurrence | null {
  if (value === null || value === undefined || value === false) return null
  if (typeof value === 'object') {
    const r = value as Partial<Recurrence>
    const interval = Number(r.interval ?? 1)
    if (['day', 'week', 'month', 'year'].includes(String(r.freq)) && Number.isInteger(interval))
      if (interval >= 1 && interval <= 365) return { freq: r.freq!, interval }
    throw new Error('Recurrencia no válida: usa { freq: day|week|month|year, interval: 1-365 }.')
  }
  const text = fold(String(value)).trim()
  if (!(text in RECURRENCE_ALIASES))
    throw new Error(
      `Recurrencia desconocida: «${String(value)}». Usa diaria, semanal, quincenal, mensual, anual o null.`,
    )
  const found = RECURRENCE_ALIASES[text]
  return found ? { ...found } : null
}

/** Fecha `AAAA-MM-DD`, «hoy», «mañana», «pasado mañana» o «ayer»; `null`/'' la quita. */
export function normalizeDate(value: unknown, today: DayKey): DayKey | null {
  if (value === null || value === undefined || value === '') return null
  const text = fold(String(value)).trim()
  const relative: Record<string, number> = {
    hoy: 0,
    today: 0,
    manana: 1,
    tomorrow: 1,
    'pasado manana': 2,
    ayer: -1,
    yesterday: -1,
  }
  if (text in relative) return addDaysToKey(today, relative[text]!)
  if (isDayKey(text)) return text
  throw new Error(`Fecha no válida: «${String(value)}». Usa AAAA-MM-DD, hoy, mañana o ayer.`)
}

/** Duración en texto («1h 30m», «2h», «1d»…) a minutos; `null`/'' la quita. */
export function normalizeEstimate(value: unknown, hoursPerDay: number): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value
  const minutes = parseDuration(String(value), hoursPerDay)
  if (minutes === null)
    throw new Error(`Duración no válida: «${String(value)}». Usa algo como 1d 2h 30m.`)
  return minutes
}

const LINK_ALIASES: Record<string, RelationKind> = {
  blocks: 'blocks',
  bloquea: 'blocks',
  'bloquea a': 'blocks',
  'blocked by': 'blocked_by',
  'bloqueada por': 'blocked_by',
  causes: 'causes',
  causa: 'causes',
  'caused by': 'caused_by',
  'causada por': 'caused_by',
  relates: 'relates',
  'relacionada con': 'relates',
  relacionada: 'relates',
  parent: 'parent',
  'subtarea de': 'parent',
  'es subtarea de': 'parent',
  child: 'child',
  subtarea: 'child',
  'tiene como subtarea a': 'child',
}

export function normalizeLinkKind(value: unknown): RelationKind {
  const text = fold(String(value ?? ''))
    .replace(/_/g, ' ')
    .trim()
  const kind = LINK_ALIASES[text]
  if (!kind)
    throw new Error(
      `Tipo de vínculo desconocido: «${String(value)}». Usa blocks, blocked_by, causes, caused_by, relates, parent o child.`,
    )
  return kind
}

const INBOX_NAMES = ['inbox', 'bandeja', 'sin proyecto', 'ninguno', 'inb']

/**
 * Proyecto por clave (`EST`) o nombre («Estudio»), sin mayúsculas ni tildes. «inbox», «sin
 * proyecto» o `null` = la bandeja (`null`). `undefined` = no se indica.
 */
export function resolveProject(value: unknown, projects: Project[]): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const text = fold(String(value)).trim()
  if (INBOX_NAMES.includes(text)) return null
  const found =
    projects.find((p) => p.key.toLowerCase() === text) ??
    projects.find((p) => fold(p.name) === text) ??
    projects.find((p) => p.id === String(value))
  if (!found)
    throw new Error(
      `Proyecto desconocido: «${String(value)}». Proyectos: ${projects.map((p) => `${p.name} (${p.key})`).join(', ') || 'ninguno'}.`,
    )
  return found.id
}

/** Ids de tags por nombre; los que no existen se devuelven en `missing` para crearlos. */
export function resolveTags(names: unknown, all: Tag[]): { ids: string[]; missing: string[] } {
  const list = Array.isArray(names) ? names : names === undefined ? [] : [names]
  const ids: string[] = []
  const missing: string[] = []
  for (const raw of list) {
    const name = String(raw).trim()
    if (!name) continue
    const tag = findTagByName(all, name)
    if (tag) {
      if (!ids.includes(tag.id)) ids.push(tag.id)
    } else if (!missing.some((m) => fold(m) === fold(name))) missing.push(name)
  }
  return { ids, missing }
}

/** Clave de tarea en mayúsculas (`est-12` → `EST-12`); error si no lo parece. */
export function normalizeKey(value: unknown): string {
  const key = String(value ?? '')
    .trim()
    .toUpperCase()
  if (!/^[A-Z][A-Z0-9]{1,5}-\d{1,7}$/.test(key))
    throw new Error(`Clave de tarea no válida: «${String(value)}». Debe ser como EST-12.`)
  return key
}

export interface TaskSummary {
  key: string
  title: string
  status: TaskStatus
  priority: Priority
  project: string | null
  startDate: DayKey | null
  endDate: DayKey | null
  estimate: string | null
  spent: string | null
  tags: string[]
  parent: string | null
  recurrence: string | null
  url: string
}

export interface SummaryContext {
  projectName: (id: string | null) => string | null
  tagName: (id: string) => string | undefined
  keyOf: (id: string) => string | undefined
  hoursPerDay: number
  baseUrl: string
}

const RECURRENCE_LABEL: Record<string, string> = {
  'day:1': 'diaria',
  'week:1': 'semanal',
  'week:2': 'quincenal',
  'month:1': 'mensual',
  'year:1': 'anual',
}

export function recurrenceLabel(r: Recurrence | null): string | null {
  if (!r) return null
  return RECURRENCE_LABEL[`${r.freq}:${r.interval}`] ?? `cada ${r.interval} ${r.freq}`
}

/** Resumen plano de una tarea para devolver a Claude. */
export function summarize(task: Task, ctx: SummaryContext): TaskSummary {
  return {
    key: task.key,
    title: task.title,
    status: task.status,
    priority: task.priority,
    project: ctx.projectName(task.projectId),
    startDate: task.startDate,
    endDate: task.endDate,
    estimate: task.estimateMin !== null ? formatDuration(task.estimateMin, ctx.hoursPerDay) : null,
    spent: task.spentMin ? formatDuration(task.spentMin, ctx.hoursPerDay) : null,
    tags: task.tagIds.map((id) => ctx.tagName(id)).filter((n): n is string => !!n),
    parent: task.parentId ? (ctx.keyOf(task.parentId) ?? null) : null,
    recurrence: recurrenceLabel(task.recurrence),
    url: `${ctx.baseUrl}t/${task.key}`,
  }
}
