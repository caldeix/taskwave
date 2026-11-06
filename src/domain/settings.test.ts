import { describe, expect, it } from 'vitest'
import { isDeleteConfirmed, parseSettings } from './settings'

const base = { displayName: '  Luis   Caldeiro ', hoursPerDay: '8', timerWarnHours: '10' }

describe('parseSettings (step-25)', () => {
  it('limpia el nombre y convierte las horas', () => {
    expect(parseSettings(base)).toEqual({
      errors: {},
      settings: { displayName: 'Luis Caldeiro', hoursPerDay: 8, timerWarnHours: 10 },
    })
  })

  it('exige nombre y horas enteras de 1 a 24', () => {
    const { errors, settings } = parseSettings({
      displayName: '  ',
      hoursPerDay: '0',
      timerWarnHours: '7,5',
    })
    expect(settings).toBeNull()
    expect(errors).toEqual({
      displayName: 'settings.errors.nameRequired',
      hoursPerDay: 'settings.errors.hours',
      timerWarnHours: 'settings.errors.hours',
    })
    expect(parseSettings({ ...base, hoursPerDay: '25' }).errors.hoursPerDay).toBeDefined()
    expect(parseSettings({ ...base, hoursPerDay: 'ocho' }).errors.hoursPerDay).toBeDefined()
    expect(parseSettings({ ...base, displayName: 'x'.repeat(101) }).errors.displayName).toBe(
      'settings.errors.nameTooLong',
    )
  })
})

describe('isDeleteConfirmed (P-9)', () => {
  it('hay que escribir la palabra, sin importar mayúsculas ni espacios', () => {
    expect(isDeleteConfirmed(' borrar ')).toBe(true)
    expect(isDeleteConfirmed('BORRA')).toBe(false)
    expect(isDeleteConfirmed('')).toBe(false)
  })
})
