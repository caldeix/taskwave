import { MAX_DISPLAY_NAME } from './profile'

/**
 * Ajustes (step-25, P-8, P-9): nombre, jornada del «1d» y aviso del cronómetro olvidado.
 * Los límites son los de las reglas de Firestore.
 */

export interface SettingsInput {
  displayName: string
  hoursPerDay: string
  timerWarnHours: string
}

export interface Settings {
  displayName: string
  hoursPerDay: number
  timerWarnHours: number
}

export type SettingsErrors = Partial<Record<keyof SettingsInput, string>>

function hours(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'))
  return Number.isInteger(value) && value >= 1 && value <= 24 ? value : null
}

/** Valida los ajustes. Devuelve claves i18n en `errors`. */
export function parseSettings(input: SettingsInput): {
  errors: SettingsErrors
  settings: Settings | null
} {
  const errors: SettingsErrors = {}
  const displayName = input.displayName.trim().replace(/\s+/g, ' ')
  if (!displayName) errors.displayName = 'settings.errors.nameRequired'
  else if (displayName.length > MAX_DISPLAY_NAME) errors.displayName = 'settings.errors.nameTooLong'
  const hoursPerDay = hours(input.hoursPerDay)
  if (hoursPerDay === null) errors.hoursPerDay = 'settings.errors.hours'
  const timerWarnHours = hours(input.timerWarnHours)
  if (timerWarnHours === null) errors.timerWarnHours = 'settings.errors.hours'
  if (Object.keys(errors).length) return { errors, settings: null }
  return {
    errors,
    settings: { displayName, hoursPerDay: hoursPerDay!, timerWarnHours: timerWarnHours! },
  }
}

/** Palabra que hay que escribir para confirmar la baja (P-9). */
export const DELETE_CONFIRM_WORD = 'BORRAR'

export function isDeleteConfirmed(text: string): boolean {
  return text.trim().toUpperCase() === DELETE_CONFIRM_WORD
}
