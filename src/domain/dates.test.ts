import { describe, expect, it } from 'vitest'
import { addDaysToKey, fromDayKey, isDayKey, overlaps, toDayKey } from './dates'

describe('fechas de día', () => {
  it('convierte en ambos sentidos sin moverse de día', () => {
    expect(toDayKey(new Date(2026, 10, 5, 23, 59))).toBe('2026-11-05')
    expect(toDayKey(fromDayKey('2026-03-29'))).toBe('2026-03-29') // cambio de hora de marzo
    expect(toDayKey(fromDayKey('2026-10-25'))).toBe('2026-10-25') // cambio de hora de octubre
  })

  it('suma días cruzando meses, años y cambios de hora', () => {
    expect(addDaysToKey('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysToKey('2026-03-28', 2)).toBe('2026-03-30')
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('valida el formato y que la fecha exista', () => {
    expect(isDayKey('2026-11-05')).toBe(true)
    expect(isDayKey('2026-02-30')).toBe(false)
    expect(isDayKey('2026-11-5')).toBe(false)
    expect(isDayKey(20261105)).toBe(false)
  })
})

describe('overlaps (D-37)', () => {
  const november = { from: '2026-11-01', to: '2026-11-30' }

  it('una tarea de un día entra si su día está dentro', () => {
    expect(overlaps('2026-11-05', null, november)).toBe(true)
    expect(overlaps('2026-10-31', null, november)).toBe(false)
    expect(overlaps('2026-12-01', null, november)).toBe(false)
  })

  it('una tarea de varios días entra si toca el rango por cualquier lado', () => {
    expect(overlaps('2026-10-28', '2026-11-02', november)).toBe(true)
    expect(overlaps('2026-11-29', '2026-12-03', november)).toBe(true)
    expect(overlaps('2026-10-01', '2026-12-31', november)).toBe(true)
    expect(overlaps('2026-10-01', '2026-10-31', november)).toBe(false)
  })

  it('sin fecha de inicio no entra en ningún rango', () => {
    expect(overlaps(null, null, november)).toBe(false)
  })
})
