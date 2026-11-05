import type { DayKey } from './dates'
import type { TaskStatus } from './status'

/**
 * Tarea (`users/{uid}/tasks/{id}`), con los campos que validan las reglas de Firestore.
 * En la app las marcas de tiempo son milisegundos (o `null`); en Firestore, `Timestamp`.
 */

export const PRIORITIES = ['high', 'medium', 'low'] as const
export type Priority = (typeof PRIORITIES)[number]

/** Tipos de vínculo de Jira (D-41). Las subtareas van aparte, en `parentId`. */
export const LINK_TYPES = ['blocks', 'blocked_by', 'causes', 'caused_by', 'relates'] as const
export type LinkType = (typeof LINK_TYPES)[number]

export interface TaskLink {
  type: LinkType
  taskId: string
}

export interface WebLink {
  url: string
  title: string
}

export interface Task {
  id: string
  key: string
  projectId: string | null
  title: string
  description: string
  status: TaskStatus
  priority: Priority
  startDate: DayKey | null
  endDate: DayKey | null
  estimateMin: number | null
  spentMin: number
  lastWorkedAtMs: number | null
  tagIds: string[]
  links: TaskLink[]
  parentId: string | null
  weblinks: WebLink[]
  resolvedAtMs: number | null
  createdAtMs: number | null
  updatedAtMs: number | null
}

/** Ámbito de la vista principal: todos los proyectos, la bandeja o un proyecto (step-8). */
export type TaskScope = { kind: 'all' } | { kind: 'inbox' } | { kind: 'project'; projectId: string }

function millis(value: unknown): number | null {
  return value && typeof (value as { toMillis?: unknown }).toMillis === 'function'
    ? (value as { toMillis: () => number }).toMillis()
    : null
}

/** Datos de Firestore → `Task`. Tolera campos que falten (datos antiguos o a medio escribir). */
export function taskFromData(id: string, data: Record<string, unknown>): Task {
  return {
    id,
    key: String(data.key ?? ''),
    projectId: (data.projectId as string | null) ?? null,
    title: String(data.title ?? ''),
    description: String(data.description ?? ''),
    status: (data.status as TaskStatus) ?? 'pending',
    priority: (data.priority as Priority) ?? 'medium',
    startDate: (data.startDate as DayKey | null) ?? null,
    endDate: (data.endDate as DayKey | null) ?? null,
    estimateMin: (data.estimateMin as number | null) ?? null,
    spentMin: Number(data.spentMin ?? 0),
    lastWorkedAtMs: millis(data.lastWorkedAt),
    tagIds: Array.isArray(data.tagIds) ? (data.tagIds as string[]) : [],
    links: Array.isArray(data.links) ? (data.links as TaskLink[]) : [],
    parentId: (data.parentId as string | null) ?? null,
    weblinks: Array.isArray(data.weblinks) ? (data.weblinks as WebLink[]) : [],
    resolvedAtMs: millis(data.resolvedAt),
    createdAtMs: millis(data.createdAt),
    updatedAtMs: millis(data.updatedAt),
  }
}
