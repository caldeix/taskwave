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

const relative = new Intl.RelativeTimeFormat('es-ES', { numeric: 'auto' })

/**
 * Fecha relativa para comentarios: «ahora», «hace 5 minutos», «hace 3 horas» y, desde un día,
 * la fecha completa («5 nov 2026, 21:18»).
 */
export function formatRelative(ms: number | null, nowMs: number): string {
  if (ms === null) return '—'
  const seconds = Math.round((nowMs - ms) / 1000)
  if (seconds < 45) return 'ahora'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return relative.format(-minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (hours < 24) return relative.format(-hours, 'hour')
  return formatDateTime(ms)
}
