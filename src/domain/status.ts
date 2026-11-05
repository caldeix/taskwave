/**
 * Estados de una tarea (D-15, D-16, D-18: fijos en v1).
 * Los colores salen del DS Personal (apartado 2.7 del plan). Las clases van escritas enteras
 * para que Tailwind las detecte al compilar.
 */
export const TASK_STATUSES = [
  'pending',
  'in_progress',
  'paused',
  'done',
  'discarded',
  'ko',
] as const

export type TaskStatus = (typeof TASK_STATUSES)[number]

/** Estados cerrados: no salen en «iniciadas» ni cuentan como atrasados (D-16). */
export const CLOSED_STATUSES: readonly TaskStatus[] = ['done', 'discarded', 'ko']

export function isClosedStatus(status: TaskStatus): boolean {
  return CLOSED_STATUSES.includes(status)
}

interface StatusStyle {
  /** Fondo y texto del badge (texto oscuro como las insignias del DS, salvo violeta por contraste). */
  badge: string
  /** Punto o barra de color (calendario, kanban). */
  dot: string
}

export const STATUS_STYLES: Record<TaskStatus, StatusStyle> = {
  pending: { badge: 'bg-violet-500 text-white', dot: 'bg-violet-500' },
  in_progress: { badge: 'bg-blue-500 text-gray-900', dot: 'bg-blue-500' },
  paused: { badge: 'bg-mustard-500 text-gray-900', dot: 'bg-mustard-500' },
  done: { badge: 'bg-emerald-500 text-gray-900', dot: 'bg-emerald-500' },
  discarded: { badge: 'bg-gray-300 text-gray-900', dot: 'bg-gray-300' },
  ko: { badge: 'bg-coral-500 text-gray-900', dot: 'bg-coral-500' },
}
