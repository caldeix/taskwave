import { describe, expect, it } from 'vitest'
import { formatDuration, formatHours, parseDuration } from './duration'

describe('parseDuration (D-30)', () => {
  it('entiende días, horas y minutos con 1d = 8 h', () => {
    expect(parseDuration('1d 2h 30m')).toBe(8 * 60 + 150)
    expect(parseDuration('2h30m')).toBe(150)
    expect(parseDuration('90m')).toBe(90)
    expect(parseDuration('1d')).toBe(480)
  })

  it('acepta decimales con coma o punto y números sueltos en horas', () => {
    expect(parseDuration('1,5h')).toBe(90)
    expect(parseDuration('0.5d')).toBe(240)
    expect(parseDuration('2')).toBe(120)
    expect(parseDuration(' 2H ')).toBe(120)
  })

  it('usa la jornada configurada', () => {
    expect(parseDuration('1d', 6)).toBe(360)
  })

  it('rechaza lo que no entiende', () => {
    expect(parseDuration('')).toBeNull()
    expect(parseDuration('mucho')).toBeNull()
    expect(parseDuration('2h abc')).toBeNull()
    expect(parseDuration('-2h')).toBeNull()
    expect(parseDuration('2x')).toBeNull()
    expect(parseDuration('99999d')).toBeNull()
  })
})

describe('formatDuration', () => {
  it('muestra solo las partes que no son cero', () => {
    expect(formatDuration(630)).toBe('1d 2h 30m')
    expect(formatDuration(480)).toBe('1d')
    expect(formatDuration(45)).toBe('45m')
    expect(formatDuration(0)).toBe('0m')
    expect(formatDuration(360, 6)).toBe('1d')
  })

  it('es la inversa de parseDuration', () => {
    for (const m of [30, 90, 480, 630, 2400]) expect(parseDuration(formatDuration(m))).toBe(m)
  })
})

describe('formatHours', () => {
  it('solo horas y minutos, sin días (para «4h de 20h»)', () => {
    expect(formatHours(240)).toBe('4h')
    expect(formatHours(270)).toBe('4h 30m')
    expect(formatHours(1560)).toBe('26h')
    expect(formatHours(0)).toBe('0h')
  })
})
