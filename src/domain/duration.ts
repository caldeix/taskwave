/**
 * Duraciones al estilo Jira (D-30): `1d 2h 30m`, donde 1d es la jornada configurada
 * (P-8: 8 h por defecto). Se guardan siempre en minutos.
 */

export const DEFAULT_HOURS_PER_DAY = 8

/** Máximo aceptado: 10 000 h (las reglas permiten hasta 1 000 000 de minutos de estimado). */
const MAX_MINUTES = 600_000

/**
 * Texto → minutos. Acepta `1d 2h 30m`, `2h30m`, `90m`, `1,5h`, `1.5d` o un número suelto, que se
 * entiende en horas. Devuelve `null` si no se entiende o es negativo.
 */
export function parseDuration(text: string, hoursPerDay = DEFAULT_HOURS_PER_DAY): number | null {
  const input = text.trim().toLowerCase().replace(/,/g, '.')
  if (!input) return null
  if (/^\d+(\.\d+)?$/.test(input)) return clamp(Math.round(Number(input) * 60))

  const unit = /(\d+(?:\.\d+)?)\s*([dhm])/g
  let total = 0
  let consumed = ''
  let match: RegExpExecArray | null
  while ((match = unit.exec(input)) !== null) {
    const value = Number(match[1])
    const factor = match[2] === 'd' ? hoursPerDay * 60 : match[2] === 'h' ? 60 : 1
    total += value * factor
    consumed += match[0]
  }
  // Todo el texto (sin espacios) tiene que haberse entendido: «2h abc» no vale.
  if (!consumed || consumed.replace(/\s/g, '') !== input.replace(/\s/g, '')) return null
  return clamp(Math.round(total))
}

function clamp(minutes: number): number | null {
  return Number.isFinite(minutes) && minutes >= 0 && minutes <= MAX_MINUTES ? minutes : null
}

/** Minutos → `1d 2h 30m` (sin partes a cero; `0m` si es cero). */
export function formatDuration(minutes: number, hoursPerDay = DEFAULT_HOURS_PER_DAY): string {
  if (minutes <= 0) return '0m'
  const dayMinutes = hoursPerDay * 60
  const days = Math.floor(minutes / dayMinutes)
  const hours = Math.floor((minutes - days * dayMinutes) / 60)
  const mins = minutes - days * dayMinutes - hours * 60
  return [days && `${days}d`, hours && `${hours}h`, mins && `${mins}m`].filter(Boolean).join(' ')
}

/** Minutos → horas legibles para la barra: `4h`, `4h 30m`, `26h` (sin días, como «4h de 20h»). */
export function formatHours(minutes: number): string {
  if (minutes <= 0) return '0h'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return [hours && `${hours}h`, mins && `${mins}m`].filter(Boolean).join(' ')
}
