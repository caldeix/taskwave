import { describe, expect, it } from 'vitest'
import {
  clampStop,
  formatClock,
  isOverWarning,
  splitByDay,
  totalMinutes,
  validateStopAt,
} from './timer'

// Los tests de la app van con la hora de Madrid (vite.config.ts).
const at = (iso: string) => new Date(iso).getTime()

describe('splitByDay (D-27)', () => {
  it('un tramo si no pasa de medianoche', () => {
    const segments = splitByDay(at('2026-11-05T09:00:00'), at('2026-11-05T10:30:20'))
    expect(segments).toEqual([
      {
        date: '2026-11-05',
        startMs: at('2026-11-05T09:00:00'),
        endMs: at('2026-11-05T10:30:20'),
        minutes: 90,
      },
    ])
  })

  it('corta a medianoche: un registro por día', () => {
    const segments = splitByDay(at('2026-11-05T23:15:00'), at('2026-11-06T01:00:00'))
    expect(segments.map((s) => [s.date, s.minutes])).toEqual([
      ['2026-11-05', 45],
      ['2026-11-06', 60],
    ])
    expect(segments[0]!.endMs).toBe(at('2026-11-06T00:00:00'))
    expect(segments[1]!.startMs).toBe(at('2026-11-06T00:00:00'))
  })

  it('un cronómetro olvidado varios días da días completos de 24 h', () => {
    const segments = splitByDay(at('2026-11-05T20:00:00'), at('2026-11-08T02:00:00'))
    expect(segments.map((s) => [s.date, s.minutes])).toEqual([
      ['2026-11-05', 240],
      ['2026-11-06', 1440],
      ['2026-11-07', 1440],
      ['2026-11-08', 120],
    ])
    expect(totalMinutes(segments)).toBe(3240)
  })

  it('respeta los cambios de hora (el día del cambio tiene 25 h)', () => {
    // 25/10/2026: en Madrid se atrasa la hora a las 3:00.
    const segments = splitByDay(at('2026-10-25T00:00:00'), at('2026-10-26T00:00:00'))
    expect(segments).toHaveLength(1)
    expect(segments[0]!.minutes).toBe(1440) // tope de las reglas: un registro ≤ 24 h
  })

  it('menos de medio minuto no se registra', () => {
    expect(splitByDay(at('2026-11-05T09:00:00'), at('2026-11-05T09:00:29'))).toEqual([])
    expect(splitByDay(at('2026-11-05T09:00:00'), at('2026-11-05T09:00:00'))).toEqual([])
    // Justo antes de medianoche: el primer tramo se queda en 0 y se descarta.
    expect(
      splitByDay(at('2026-11-05T23:59:50'), at('2026-11-06T00:10:00')).map((s) => s.date),
    ).toEqual(['2026-11-06'])
  })
})

describe('formatClock, isOverWarning, validateStopAt y clampStop', () => {
  it('formatea el tiempo transcurrido', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(307_000)).toBe('5:07')
    expect(formatClock(3_907_000)).toBe('1:05:07')
    expect(formatClock(-5000)).toBe('0:00')
  })

  it('avisa a partir de las horas configuradas (D-28)', () => {
    expect(isOverWarning(8 * 3_600_000 - 1, 8)).toBe(false)
    expect(isOverWarning(8 * 3_600_000, 8)).toBe(true)
    expect(isOverWarning(2 * 3_600_000, 2)).toBe(true)
  })

  it('la hora de fin no puede ser antes del inicio ni en el futuro', () => {
    const start = at('2026-11-05T09:00:00')
    const now = at('2026-11-05T18:00:00')
    expect(validateStopAt(start, start, now)).toBe('beforeStart')
    expect(validateStopAt(start, at('2026-11-05T13:00:00'), now)).toBeNull()
    expect(validateStopAt(start, now + 30_000, now)).toBeNull()
    expect(validateStopAt(start, now + 120_000, now)).toBe('inFuture')
  })

  it('si el reloj del equipo va atrasado, el fin no queda antes del inicio', () => {
    expect(clampStop(1000, 900)).toBe(1000)
    expect(clampStop(1000, 2000)).toBe(2000)
  })
})
