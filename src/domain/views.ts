/**
 * Vista principal elegida y su reflejo en la URL (`?vista=`): calendario, kanban y, desde la
 * v1.1.0, lista (D-6) y backlog (D-8). En la URL va en español porque es lo que ve el usuario; en
 * las preferencias, en inglés.
 */
export const MAIN_VIEWS = ['calendar', 'kanban', 'list', 'backlog'] as const
export type MainView = (typeof MAIN_VIEWS)[number]

const TO_QUERY: Record<MainView, string> = {
  calendar: 'calendario',
  kanban: 'kanban',
  list: 'lista',
  backlog: 'backlog',
}

export function viewToQuery(view: MainView): string {
  return TO_QUERY[view]
}

/** Lee `?vista=` y, si no viene o no es válido, usa la preferencia guardada. */
export function viewFromQuery(value: unknown, fallback: MainView): MainView {
  const found = MAIN_VIEWS.find((view) => TO_QUERY[view] === value)
  return found ?? fallback
}
