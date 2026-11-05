/**
 * Vista principal elegida (calendario o kanban) y su reflejo en la URL (`?vista=`).
 * En la URL va en español porque es lo que ve el usuario; en las preferencias, en inglés.
 */
export type MainView = 'calendar' | 'kanban'

const TO_QUERY: Record<MainView, string> = { calendar: 'calendario', kanban: 'kanban' }

export function viewToQuery(view: MainView): string {
  return TO_QUERY[view]
}

/** Lee `?vista=` y, si no viene o no es válido, usa la preferencia guardada. */
export function viewFromQuery(value: unknown, fallback: MainView): MainView {
  if (value === 'calendario') return 'calendar'
  if (value === 'kanban') return 'kanban'
  return fallback
}
