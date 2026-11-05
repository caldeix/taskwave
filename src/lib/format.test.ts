import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime } from './format'

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
