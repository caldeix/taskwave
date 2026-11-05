/** Formatos de fecha de la app: español y hora de Madrid (P-3). */

const TIME_ZONE = 'Europe/Madrid'

const dateTime = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: TIME_ZONE,
})

const dateOnly = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeZone: TIME_ZONE })

/** «5 nov 2026, 21:18». Devuelve «—» si no hay fecha. */
export function formatDateTime(ms: number | null): string {
  return ms === null ? '—' : dateTime.format(ms)
}

/** «5 nov 2026». Devuelve «—» si no hay fecha. */
export function formatDate(ms: number | null): string {
  return ms === null ? '—' : dateOnly.format(ms)
}
