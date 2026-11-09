import { PRIORITIES } from './task'

/**
 * Copia de seguridad (plan TASKWAVE-02, idea 10, D-12, CA-10a): un JSON con todo lo del usuario y
 * un CSV de tareas. Lógica pura: pasar las marcas de tiempo a JSON y de vuelta, validar una copia
 * y escribir el CSV. La lectura y la escritura en Firestore están en `src/data/backup.ts`.
 */

export const BACKUP_APP = 'TaskWave'
export const BACKUP_FORMAT = 1

export type Doc = Record<string, unknown> & { id: string }

export interface Backup {
  app: typeof BACKUP_APP
  format: number
  version: string
  exportedAt: string
  projects: Doc[]
  tags: Doc[]
  /** Cada tarea lleva sus comentarios en `comments`. */
  tasks: Doc[]
  worklogs: Doc[]
  templates: Doc[]
}

/** Marca de tiempo en el JSON: `{ "$ts": milisegundos }`. */
interface TsMark {
  $ts: number
}

const isTimestampLike = (v: unknown): v is { toMillis: () => number } =>
  !!v && typeof v === 'object' && typeof (v as { toMillis?: unknown }).toMillis === 'function'

const isTsMark = (v: unknown): v is TsMark =>
  !!v &&
  typeof v === 'object' &&
  Object.keys(v).length === 1 &&
  typeof (v as TsMark).$ts === 'number'

/** Firestore → JSON: las marcas de tiempo pasan a `{ $ts }`, en cualquier nivel. */
export function toJsonValue(value: unknown): unknown {
  if (isTimestampLike(value)) return { $ts: value.toMillis() }
  if (Array.isArray(value)) return value.map(toJsonValue)
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toJsonValue(v)]))
  return value
}

/** JSON → Firestore: `{ $ts }` vuelve a ser una marca de tiempo con `fromMillis`. */
export function fromJsonValue(value: unknown, fromMillis: (ms: number) => unknown): unknown {
  if (isTsMark(value)) return fromMillis(value.$ts)
  if (Array.isArray(value)) return value.map((v) => fromJsonValue(v, fromMillis))
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, fromJsonValue(v, fromMillis)]),
    )
  return value
}

export type BackupError = 'notJson' | 'notTaskWave' | 'newerFormat' | 'malformed'

/** Valida un fichero de copia; devuelve la copia o el motivo por el que no vale. */
export function parseBackup(text: string): Backup | BackupError {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return 'notJson'
  }
  const b = data as Partial<Backup>
  if (!b || typeof b !== 'object' || b.app !== BACKUP_APP) return 'notTaskWave'
  if (typeof b.format !== 'number' || b.format > BACKUP_FORMAT) return 'newerFormat'
  const lists = ['projects', 'tags', 'tasks', 'worklogs', 'templates'] as const
  for (const name of lists) {
    const list = b[name]
    if (!Array.isArray(list) || list.some((d) => !d || typeof (d as Doc).id !== 'string'))
      return 'malformed'
  }
  return b as Backup
}

export function isBackupError(value: Backup | BackupError): value is BackupError {
  return typeof value === 'string'
}

/** Número de una clave (`EST-12` → 12). */
export function keyNumber(key: unknown): number {
  const match = /-(\d+)$/.exec(String(key ?? ''))
  return match ? Number(match[1]) : 0
}

// ------------------------------------------------------------------- CSV de tareas

const CSV_COLUMNS = [
  'clave',
  'titulo',
  'estado',
  'prioridad',
  'proyecto',
  'inicio',
  'fin',
  'estimado_min',
  'horas_min',
  'tags',
  'cerrada',
] as const

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  // Evita que una hoja de cálculo interprete una fórmula (=, +, -, @) al abrir el CSV.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
  return /[",;\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** CSV de tareas (separado por comas, con BOM para que Excel lea bien las tildes). */
export function tasksToCsv(
  tasks: Doc[],
  names: { project: (id: string | null) => string; tag: (id: string) => string },
): string {
  const rows = tasks.map((t) => {
    const resolved = t.resolvedAt as { $ts?: number } | null | undefined
    return [
      t.key,
      t.title,
      t.status,
      PRIORITIES.includes(t.priority as never) ? t.priority : '',
      names.project((t.projectId as string | null) ?? null),
      t.startDate,
      t.endDate,
      t.estimateMin,
      t.spentMin,
      ((t.tagIds as string[] | undefined) ?? []).map(names.tag).join(', '),
      resolved?.$ts ? new Date(resolved.$ts).toISOString().slice(0, 10) : '',
    ]
      .map(csvCell)
      .join(',')
  })
  return '﻿' + [CSV_COLUMNS.join(','), ...rows].join('\r\n') + '\r\n'
}
