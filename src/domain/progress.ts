import { isClosedStatus } from './status'
import type { Task } from './task'

/**
 * Progreso de una tarea para las tarjetas del kanban (plan TASKWAVE-02, idea 4, D-5): subtareas
 * cerradas, casillas marcadas de la descripción, horas sobre el estimado y si la bloquea alguna
 * tarea abierta. Se calcula con las tareas ya leídas, sin lecturas extra.
 */

export interface Count {
  done: number
  total: number
}

export interface CardProgress {
  /** Subtareas entre las tareas leídas (`null` si no tiene). */
  subtasks: Count | null
  /** Casillas `- [ ]` / `- [x]` de la descripción (`null` si no tiene). */
  checklist: Count | null
  /** Minutos gastados y estimados (`null` si no hay ni horas ni estimado). */
  hours: { spentMin: number; estimateMin: number | null } | null
  /** Claves de las tareas abiertas que la bloquean (las que se conocen). */
  blockedBy: string[]
}

const CHECKBOX = /^\s*(?:[-*+]|\d+[.)])\s+\[( |x|X)\]\s/
const FENCE = /^\s*(```|~~~)/

/** Cuenta las casillas de una lista de tareas en markdown, sin contar las de bloques de código. */
export function checklistProgress(markdown: string): Count | null {
  let inCode = false
  let done = 0
  let total = 0
  for (const line of markdown.split('\n')) {
    if (FENCE.test(line)) {
      inCode = !inCode
      continue
    }
    if (inCode) continue
    const match = CHECKBOX.exec(line)
    if (!match) continue
    total += 1
    if (match[1] !== ' ') done += 1
  }
  return total ? { done, total } : null
}

/** Índice para calcular el progreso de muchas tarjetas a la vez. */
export interface ProgressIndex {
  byId: Map<string, Task>
  children: Map<string, Task[]>
}

export function progressIndex(tasks: Task[]): ProgressIndex {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const children = new Map<string, Task[]>()
  for (const task of tasks) {
    if (!task.parentId) continue
    const list = children.get(task.parentId) ?? []
    list.push(task)
    children.set(task.parentId, list)
  }
  return { byId, children }
}

export function cardProgress(task: Task, index: ProgressIndex): CardProgress {
  const subs = index.children.get(task.id) ?? []
  const blockedBy = task.links
    .filter((l) => l.type === 'blocked_by')
    .map((l) => index.byId.get(l.taskId))
    .filter((other): other is Task => !!other && !isClosedStatus(other.status))
    .map((other) => other.key)
  return {
    subtasks: subs.length
      ? { done: subs.filter((s) => isClosedStatus(s.status)).length, total: subs.length }
      : null,
    checklist: checklistProgress(task.description),
    hours:
      task.spentMin > 0 || task.estimateMin !== null
        ? { spentMin: task.spentMin, estimateMin: task.estimateMin }
        : null,
    blockedBy,
  }
}
