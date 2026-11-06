import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, formatRelative } from './format'

describe('formatos de fecha', () => {
  // 31/12/2026 23:30 UTC = 1/1/2027 00:30 en Madrid (invierno, UTC+1)
  const nochevieja = Date.UTC(2026, 11, 31, 23, 30)

  it('usa la hora de Madrid, no la del equipo', () => {
    expect(formatDate(nochevieja)).toContain('2027')
    expect(formatDateTime(nochevieja)).toContain('0:30')
  })

  it('sin fecha muestra una raya', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDateTime(null)).toBe('—')
  })
})

describe('formatRelative (comentarios)', () => {
  const now = Date.UTC(2026, 10, 6, 12, 0)

  it('dice «ahora», minutos u horas el primer día', () => {
    expect(formatRelative(now - 10_000, now)).toBe('ahora')
    expect(formatRelative(now + 5_000, now)).toBe('ahora') // reloj del servidor algo adelantado
    expect(formatRelative(now - 5 * 60_000, now)).toBe('hace 5 minutos')
    expect(formatRelative(now - 60_000, now)).toBe('hace 1 minuto')
    expect(formatRelative(now - 3 * 3_600_000, now)).toBe('hace 3 horas')
  })

  it('desde un día muestra la fecha completa', () => {
    expect(formatRelative(now - 30 * 3_600_000, now)).toBe(formatDateTime(now - 30 * 3_600_000))
    expect(formatRelative(null, now)).toBe('—')
  })
})
