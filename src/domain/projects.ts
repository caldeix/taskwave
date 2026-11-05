/**
 * Proyectos o espacios (step-8, D-11, D-12, D-14).
 * La clave (`EST`) es el prefijo de las tareas (`EST-12`) y no cambia después de crear el proyecto.
 */

export const PROJECT_COLORS = ['blue', 'emerald', 'mustard', 'coral', 'violet', 'gray'] as const
export type ProjectColor = (typeof PROJECT_COLORS)[number]

/** Iconos disponibles (nombres de lucide). */
export const PROJECT_ICONS = [
  'folder',
  'book-open',
  'graduation-cap',
  'briefcase',
  'home',
  'heart',
  'dumbbell',
  'code',
  'music',
  'plane',
  'shopping-cart',
  'star',
] as const
export type ProjectIconName = (typeof PROJECT_ICONS)[number]

export interface Project {
  id: string
  name: string
  key: string
  color: ProjectColor
  icon: string
  order: number
  archived: boolean
  taskCounter: number
}

/** Clave reservada para la bandeja «Sin proyecto» (D-11). */
export const INBOX_KEY = 'INB'

export const PROJECT_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,5}$/
export const MAX_PROJECT_NAME = 60

/** Clases del DS para el color de un proyecto (escritas enteras para que Tailwind las vea). */
export const PROJECT_COLOR_CLASSES: Record<ProjectColor, { dot: string; text: string }> = {
  blue: { dot: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400' },
  emerald: { dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-500' },
  mustard: { dot: 'bg-mustard-500', text: 'text-mustard-700 dark:text-mustard-500' },
  coral: { dot: 'bg-coral-500', text: 'text-coral-700 dark:text-coral-500' },
  violet: { dot: 'bg-violet-500', text: 'text-violet-700 dark:text-violet-500' },
  gray: { dot: 'bg-gray-500', text: 'text-gray-500 dark:text-gray-400' },
}

function lettersOnly(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .trim()
}

/**
 * Propone una clave a partir del nombre: las tres primeras letras («Estudio» → «EST») o las
 * iniciales si hay varias palabras («Casa de la playa» → «CDLP»). Si ya existe, añade un número.
 */
export function suggestKey(name: string, existingKeys: readonly string[]): string {
  const words = lettersOnly(name).split(/\s+/).filter(Boolean)
  let base =
    words.length > 1
      ? words
          .map((w) => w[0])
          .join('')
          .slice(0, 4)
      : (words[0] ?? '').slice(0, 3)
  base = base.replace(/^[0-9]+/, '')
  if (base.length < 2) base = (base + 'PRY').slice(0, 3)
  const taken = new Set([...existingKeys, INBOX_KEY])
  if (!taken.has(base)) return base
  for (let n = 2; n < 100; n++) {
    const candidate = `${base.slice(0, 5)}${n}`.slice(0, 6)
    if (!taken.has(candidate)) return candidate
  }
  return base
}

export interface ProjectInput {
  name: string
  key: string
  color: string
  icon: string
}

export type ProjectErrors = Partial<Record<keyof ProjectInput, string>>

/** Valida el formulario. `existingKeys` son las claves de los demás proyectos. Devuelve claves i18n. */
export function validateProject(
  input: ProjectInput,
  existingKeys: readonly string[],
): ProjectErrors {
  const errors: ProjectErrors = {}
  const name = input.name.trim()
  if (!name) errors.name = 'projects.validation.nameRequired'
  else if (name.length > MAX_PROJECT_NAME) errors.name = 'projects.validation.nameTooLong'
  if (!PROJECT_KEY_PATTERN.test(input.key)) errors.key = 'projects.validation.keyFormat'
  else if (input.key === INBOX_KEY || existingKeys.includes(input.key))
    errors.key = 'projects.validation.keyTaken'
  if (!(PROJECT_COLORS as readonly string[]).includes(input.color))
    errors.color = 'projects.validation.color'
  if (!(PROJECT_ICONS as readonly string[]).includes(input.icon))
    errors.icon = 'projects.validation.icon'
  return errors
}

/** Proyectos ordenados por su campo `order` (y por nombre si empatan). */
export function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'es'))
}

/**
 * Mueve un proyecto una posición arriba o abajo entre los activos. Devuelve los cambios de
 * `order` a guardar (normalmente dos), o una lista vacía si no se puede mover.
 */
export function moveProject(
  projects: Project[],
  id: string,
  direction: 'up' | 'down',
): { id: string; order: number }[] {
  const list = sortProjects(projects.filter((p) => !p.archived))
  const index = list.findIndex((p) => p.id === id)
  const target = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || target < 0 || target >= list.length) return []
  // Se renumera la lista entera (0, 1, 2…) para que los empates o huecos no bloqueen el cambio.
  const reordered = [...list]
  const [moved] = reordered.splice(index, 1)
  reordered.splice(target, 0, moved!)
  return reordered
    .map((p, order) => ({ id: p.id, order }))
    .filter(({ id: pid, order }) => list.find((p) => p.id === pid)!.order !== order)
}

/** Siguiente posición libre al final de la lista. */
export function nextOrder(projects: Project[]): number {
  return projects.reduce((max, p) => Math.max(max, p.order + 1), 0)
}
