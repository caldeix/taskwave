import { PRIORITIES, type Task } from './task'
import { TASK_STATUSES } from './status'

/**
 * Vista de lista (plan TASKWAVE-02, ideas 5 y 6, D-6, D-7): orden por columnas y ayudas para los
 * cambios en bloque. Lógica pura.
 */

export const TABLE_COLUMNS = [
  'key',
  'title',
  'status',
  'priority',
  'project',
  'startDate',
  'endDate',
  'estimate',
  'spent',
] as const
export type TableColumn = (typeof TABLE_COLUMNS)[number]
export type SortDir = 'asc' | 'desc'

type Value = string | number | null

function value(task: Task, column: TableColumn, projectName: (t: Task) => string): Value {
  switch (column) {
    case 'key':
      return task.key
    case 'title':
      return task.title
    case 'status':
      return TASK_STATUSES.indexOf(task.status)
    case 'priority':
      return PRIORITIES.indexOf(task.priority)
    case 'project':
      return projectName(task)
    case 'startDate':
      return task.startDate
    case 'endDate':
      return task.endDate
    case 'estimate':
      return task.estimateMin
    case 'spent':
      return task.spentMin
  }
}

const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' })

/**
 * Ordena por una columna. Los vacíos (sin fecha, sin estimado…) van siempre al final, en los dos
 * sentidos; los empates, por clave.
 */
export function sortTable(
  tasks: Task[],
  column: TableColumn,
  dir: SortDir,
  projectName: (t: Task) => string = () => '',
): Task[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...tasks].sort((a, b) => {
    const va = value(a, column, projectName)
    const vb = value(b, column, projectName)
    if (va === null || va === '')
      return vb === null || vb === '' ? collator.compare(a.key, b.key) : 1
    if (vb === null || vb === '') return -1
    const diff =
      typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : collator.compare(String(va), String(vb))
    return diff !== 0 ? sign * diff : collator.compare(a.key, b.key)
  })
}

/** Siguiente orden al pulsar la cabecera: otra columna empieza ascendente; la misma, alterna. */
export function nextSort(
  current: { column: TableColumn; dir: SortDir },
  column: TableColumn,
): { column: TableColumn; dir: SortDir } {
  if (current.column !== column) return { column, dir: 'asc' }
  return { column, dir: current.dir === 'asc' ? 'desc' : 'asc' }
}

export const MAX_TAGS_PER_TASK = 20

/** Tags tras añadir uno en bloque (sin repetir y sin pasar del máximo); `null` si no cambia. */
export function withTag(tagIds: string[], tagId: string): string[] | null {
  if (tagIds.includes(tagId) || tagIds.length >= MAX_TAGS_PER_TASK) return null
  return [...tagIds, tagId]
}

/** Tags tras quitar uno en bloque; `null` si no lo tenía. */
export function withoutTag(tagIds: string[], tagId: string): string[] | null {
  return tagIds.includes(tagId) ? tagIds.filter((id) => id !== tagId) : null
}
