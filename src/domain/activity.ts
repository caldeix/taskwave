/**
 * Actividad de una tarea (`users/{uid}/tasks/{id}/activity/{aid}`, step-22, D-42, CA-16).
 * Cada cambio de los campos vigilados deja una entrada `{ field, from, to, at }` escrita en el
 * mismo lote que el cambio, así que no puede haber cambio sin rastro ni rastro sin cambio.
 * Las entradas no se editan nunca (reglas); se borran con la tarea.
 */

/** Campos que se apuntan (CA-16: estado, fechas, estimado, prioridad y proyecto; y el título). */
export const TRACKED_FIELDS = [
  'status',
  'startDate',
  'endDate',
  'estimateMin',
  'priority',
  'projectId',
  'title',
] as const
export type TrackedField = (typeof TRACKED_FIELDS)[number]

/** Además de los campos, el alta de la tarea (`to` = su clave). */
export type ActivityField = TrackedField | 'created'

export type ActivityValue = string | number | boolean | null

export interface ActivityChange {
  field: ActivityField
  from: ActivityValue
  to: ActivityValue
}

export interface ActivityEntry extends ActivityChange {
  id: string
  atMs: number | null
}

function normalize(value: unknown): ActivityValue {
  if (value === undefined || value === null) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return value
  return null
}

/**
 * Cambios que hay que apuntar al aplicar `patch` sobre `before`: solo los campos vigilados que
 * vienen en el parche y cambian de valor.
 */
export function activityChanges(
  before: Partial<Record<TrackedField, unknown>>,
  patch: Record<string, unknown>,
): ActivityChange[] {
  return TRACKED_FIELDS.filter((field) => field in patch)
    .map((field) => ({ field, from: normalize(before[field]), to: normalize(patch[field]) }))
    .filter((c) => c.from !== c.to)
}

function millis(value: unknown): number | null {
  return value && typeof (value as { toMillis?: unknown }).toMillis === 'function'
    ? (value as { toMillis: () => number }).toMillis()
    : null
}

export function activityFromData(id: string, data: Record<string, unknown>): ActivityEntry {
  return {
    id,
    field: String(data.field ?? '') as ActivityField,
    from: normalize(data.from),
    to: normalize(data.to),
    atMs: millis(data.at),
  }
}
