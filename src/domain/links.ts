import { isClosedStatus } from './status'
import { LINK_TYPES, type LinkType, type Task, type TaskLink } from './task'

/**
 * Vínculos de tipo Jira y subtareas de un nivel (step-16, D-32, D-41). Lógica pura: las
 * escrituras están en `src/data/taskWrites.ts`.
 *
 * - Un vínculo se guarda en las dos tareas, cada una con su tipo: si A bloquea a B, B está
 *   bloqueada por A. «Relacionada con» es igual en los dos sentidos.
 * - Las subtareas no son vínculos: la hija guarda `parentId`. Solo hay un nivel, así que una
 *   subtarea no puede tener subtareas ni una tarea con subtareas puede ser subtarea.
 */

export const MAX_LINKS = 50

export const INVERSE_LINK: Record<LinkType, LinkType> = {
  blocks: 'blocked_by',
  blocked_by: 'blocks',
  causes: 'caused_by',
  caused_by: 'causes',
  relates: 'relates',
}

/** Lo que se puede elegir al vincular: los tipos de Jira y las dos relaciones de subtarea. */
export type RelationKind = LinkType | 'parent' | 'child'
export const RELATION_KINDS: RelationKind[] = [...LINK_TYPES, 'parent', 'child']

export function isLinkType(kind: RelationKind): kind is LinkType {
  return (LINK_TYPES as readonly string[]).includes(kind)
}

/** El vínculo que se guarda en la otra tarea. */
export function inverseLink(link: TaskLink, fromTaskId: string): TaskLink {
  return { type: INVERSE_LINK[link.type], taskId: fromTaskId }
}

export type RelationError =
  | 'self'
  | 'duplicate'
  | 'tooManyLinks'
  | 'targetTooManyLinks'
  | 'alreadyParent'
  | 'alreadyChild'
  | 'subtaskCannotHaveSubtasks'
  | 'parentIsSubtask'
  | 'hasSubtasks'
  | 'targetHasSubtasks'

/**
 * Comprueba si `task` puede relacionarse con `target` de esa forma. Devuelve el motivo si no
 * (clave i18n `links.errors.<motivo>`) o `null` si se puede.
 *
 * - `parent`: `target` pasa a ser la padre de `task`.
 * - `child`: `target` pasa a ser subtarea de `task`.
 * `taskHasSubtasks` y `targetHasSubtasks` hacen falta porque las subtareas no se guardan en la
 * padre (se buscan por `parentId`).
 */
export function checkRelation(
  task: Task,
  target: Task,
  kind: RelationKind,
  taskHasSubtasks: boolean,
  targetHasSubtasks: boolean,
): RelationError | null {
  if (task.id === target.id) return 'self'
  if (isLinkType(kind)) {
    if (task.links.some((l) => l.type === kind && l.taskId === target.id)) return 'duplicate'
    if (task.links.length >= MAX_LINKS) return 'tooManyLinks'
    if (target.links.length >= MAX_LINKS) return 'targetTooManyLinks'
    return null
  }
  if (kind === 'parent') {
    if (task.parentId === target.id) return 'alreadyParent'
    if (taskHasSubtasks) return 'hasSubtasks'
    if (target.parentId) return 'parentIsSubtask'
    return null
  }
  // child
  if (target.parentId === task.id) return 'alreadyChild'
  if (task.parentId) return 'subtaskCannotHaveSubtasks'
  if (targetHasSubtasks) return 'targetHasSubtasks'
  return null
}

/** Vínculos agrupados por tipo, en el orden de `LINK_TYPES`, para la vista de tarea. */
export function groupLinks(links: TaskLink[]): { type: LinkType; taskIds: string[] }[] {
  return LINK_TYPES.map((type) => ({
    type,
    taskIds: [...new Set(links.filter((l) => l.type === type).map((l) => l.taskId))],
  })).filter((group) => group.taskIds.length > 0)
}

/** Ids de todas las tareas relacionadas: vinculadas y padre (las hijas se buscan aparte). */
export function relatedIds(task: Task): string[] {
  const ids = new Set(task.links.map((l) => l.taskId))
  if (task.parentId) ids.add(task.parentId)
  ids.delete(task.id)
  return [...ids]
}

export interface SubtaskTotals {
  count: number
  closed: number
  /** Horas de la propia tarea. */
  ownSpentMin: number
  subtasksSpentMin: number
  totalSpentMin: number
  /** Estimado de la padre más el de las subtareas; `null` si ninguna tiene. */
  totalEstimateMin: number | null
}

/** Horas de la padre y total con sus subtareas (D-32, CA-15), como el «Σ» de Jira. */
export function subtaskTotals(parent: Task, subtasks: Task[]): SubtaskTotals {
  const subtasksSpentMin = subtasks.reduce((sum, t) => sum + t.spentMin, 0)
  const estimates = [parent, ...subtasks]
    .map((t) => t.estimateMin)
    .filter((e): e is number => e !== null)
  return {
    count: subtasks.length,
    closed: subtasks.filter((t) => isClosedStatus(t.status)).length,
    ownSpentMin: parent.spentMin,
    subtasksSpentMin,
    totalSpentMin: parent.spentMin + subtasksSpentMin,
    totalEstimateMin: estimates.length ? estimates.reduce((a, b) => a + b, 0) : null,
  }
}

/** Normaliza lo que se escribe en el buscador: `est-12` o ` EST-12 ` → `EST-12`. */
export function parseTaskKey(text: string): string | null {
  const key = text.trim().toUpperCase()
  return /^[A-Z][A-Z0-9]{1,5}-[0-9]{1,7}$/.test(key) ? key : null
}

function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/**
 * Busca tareas por clave o por palabras del título (sin tildes ni mayúsculas). Las que
 * coinciden en la clave van primero; luego las abiertas. Excluye las indicadas.
 */
export function searchTasks(tasks: Task[], text: string, exclude: Set<string>, max = 8): Task[] {
  const words = fold(text).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const scored = tasks
    .filter((t) => !exclude.has(t.id))
    .map((t) => {
      const key = t.key.toLowerCase()
      const title = fold(t.title)
      const keyHit = words.length === 1 && key.startsWith(words[0]!)
      const titleHit = words.every((w) => title.includes(w) || key.includes(w))
      return { t, keyHit, hit: keyHit || titleHit }
    })
    .filter((s) => s.hit)
  scored.sort(
    (a, b) =>
      Number(b.keyHit) - Number(a.keyHit) ||
      Number(isClosedStatus(a.t.status)) - Number(isClosedStatus(b.t.status)) ||
      a.t.key.localeCompare(b.t.key, 'es', { numeric: true }),
  )
  return scored.slice(0, max).map((s) => s.t)
}
