import { PROJECT_COLORS, type ProjectColor } from './projects'

/**
 * Catálogo de tags con color (step-17, D-40). Las tareas guardan solo los ids (`tagIds`), así
 * que renombrar o cambiar el color de un tag se ve al momento en todas sus tareas.
 * Lógica pura: las escrituras están en `src/data/tagWrites.ts`.
 */

export interface Tag {
  id: string
  name: string
  color: ProjectColor
}

/** Límites de las reglas de Firestore (nombre de 1 a 40 y 20 tags por tarea). */
export const MAX_TAG_NAME = 40
export const MAX_TAGS_PER_TASK = 20
/** Límite propio del catálogo, para que el selector siga siendo manejable. */
export const MAX_TAGS = 100

export const TAG_COLORS = PROJECT_COLORS

/** Quita espacios sobrantes: `  Uni   2026 ` → `Uni 2026`. */
export function normalizeTagName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

/** Para comparar sin mayúsculas ni tildes. */
export function foldTagName(name: string): string {
  return normalizeTagName(name).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

export type TagNameError = 'required' | 'tooLong' | 'duplicate'

/**
 * Valida el nombre de un tag nuevo o renombrado (`exceptId`: el que se renombra).
 * No puede repetirse aunque cambien las mayúsculas o las tildes.
 */
export function validateTagName(name: string, all: Tag[], exceptId?: string): TagNameError | null {
  const normalized = normalizeTagName(name)
  if (!normalized) return 'required'
  if (normalized.length > MAX_TAG_NAME) return 'tooLong'
  const folded = foldTagName(normalized)
  if (all.some((t) => t.id !== exceptId && foldTagName(t.name) === folded)) return 'duplicate'
  return null
}

export function sortTags(tags: Tag[]): Tag[] {
  return [...tags].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
}

/** El tag con ese nombre exacto (sin mayúsculas ni tildes), si existe. */
export function findTagByName(all: Tag[], name: string): Tag | undefined {
  const folded = foldTagName(name)
  return folded ? all.find((t) => foldTagName(t.name) === folded) : undefined
}

/**
 * Sugerencias del selector: los tags que contienen el texto (primero los que empiezan por él),
 * sin los ya elegidos. Con el texto vacío, todos por orden alfabético.
 */
export function suggestTags(all: Tag[], text: string, selected: string[], max = 8): Tag[] {
  const q = foldTagName(text)
  const chosen = new Set(selected)
  const candidates = sortTags(all).filter((t) => !chosen.has(t.id))
  if (!q) return candidates.slice(0, max)
  const starts = candidates.filter((t) => foldTagName(t.name).startsWith(q))
  const contains = candidates.filter(
    (t) => !foldTagName(t.name).startsWith(q) && foldTagName(t.name).includes(q),
  )
  return [...starts, ...contains].slice(0, max)
}

/** Color para un tag nuevo: el menos usado del catálogo (en empate, el primero de la paleta). */
export function nextTagColor(all: Tag[]): ProjectColor {
  const uses = new Map<ProjectColor, number>(TAG_COLORS.map((c) => [c, 0]))
  for (const t of all) uses.set(t.color, (uses.get(t.color) ?? 0) + 1)
  return TAG_COLORS.reduce((best, c) => (uses.get(c)! < uses.get(best)! ? c : best), TAG_COLORS[0])
}

/** Tags de una tarea en orden alfabético; ignora ids de tags borrados. */
export function tagsOf(tagIds: string[], all: Tag[]): Tag[] {
  const byId = new Map(all.map((t) => [t.id, t]))
  return sortTags(tagIds.map((id) => byId.get(id)).filter((t): t is Tag => Boolean(t)))
}
