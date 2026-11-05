import { isDayKey, type DayKey } from './dates'
import type { WebLink } from './task'

/**
 * Edición de una tarea desde su vista (step-14, D-31, D-45, D-46). Lógica pura.
 */

/** Valida un cambio de fechas. Devuelve la clave i18n del error o `null`. */
export function validateDates(start: DayKey | null, end: DayKey | null): string | null {
  if (start !== null && !isDayKey(start)) return 'tasks.validation.dateInvalid'
  if (end !== null && !isDayKey(end)) return 'tasks.validation.dateInvalid'
  if (end !== null && start === null) return 'tasks.validation.endWithoutStart'
  if (start !== null && end !== null && end < start) return 'tasks.validation.endBeforeStart'
  return null
}

/** Fin igual al inicio = tarea de un día (se guarda sin fin, como al crearla). */
export function normalizeDates(start: DayKey | null, end: DayKey | null) {
  return { startDate: start, endDate: end && end !== start ? end : null }
}

/**
 * Barra de horas (D-31): la parte amarilla es el estimado y la verde lo gastado. Si lo gastado
 * supera el estimado, la barra representa lo gastado: el estimado ocupa su parte y el exceso
 * se pinta en coral. Porcentajes de 0 a 100 sobre el ancho de la barra.
 */
export interface Progress {
  hasEstimate: boolean
  /** % de lo gastado sobre el estimado (puede pasar de 100); `null` sin estimado. */
  percent: number | null
  /** Ancho del tramo verde (dentro del estimado). */
  spentWidth: number
  /** Ancho del tramo del estimado (amarillo) en la barra. */
  estimateWidth: number
  /** Ancho del exceso (coral). */
  excessWidth: number
  excessMin: number
}

export function computeProgress(spentMin: number, estimateMin: number | null): Progress {
  if (!estimateMin || estimateMin <= 0) {
    return {
      hasEstimate: false,
      percent: null,
      spentWidth: spentMin > 0 ? 100 : 0,
      estimateWidth: 0,
      excessWidth: 0,
      excessMin: 0,
    }
  }
  const percent = Math.round((spentMin / estimateMin) * 100)
  if (spentMin <= estimateMin) {
    return {
      hasEstimate: true,
      percent,
      spentWidth: (spentMin / estimateMin) * 100,
      estimateWidth: 100,
      excessWidth: 0,
      excessMin: 0,
    }
  }
  const estimateWidth = (estimateMin / spentMin) * 100
  return {
    hasEstimate: true,
    percent,
    spentWidth: estimateWidth,
    estimateWidth,
    excessWidth: 100 - estimateWidth,
    excessMin: spentMin - estimateMin,
  }
}

export const MAX_WEBLINKS = 20
export const MAX_WEBLINK_TITLE = 100
export const MAX_URL = 2000

/**
 * Valida un enlace web (D-45). Solo `http` y `https`: nunca `javascript:` ni `data:`, que
 * permitirían ejecutar código al pulsarlo (XSS). Devuelve el enlace limpio o la clave del error.
 */
export function validateWebLink(
  url: string,
  title: string,
  existing: WebLink[],
): { link: WebLink } | { error: string } {
  const trimmed = url.trim()
  if (existing.length >= MAX_WEBLINKS) return { error: 'taskView.links.tooMany' }
  if (!trimmed || trimmed.length > MAX_URL) return { error: 'taskView.links.invalid' }
  let parsed: URL
  try {
    parsed = new URL(/^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    return { error: 'taskView.links.invalid' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    return { error: 'taskView.links.invalid' }
  if (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost')
    return { error: 'taskView.links.invalid' }
  const href = parsed.href
  if (existing.some((l) => l.url === href)) return { error: 'taskView.links.duplicate' }
  return { link: { url: href, title: title.trim().slice(0, MAX_WEBLINK_TITLE) || parsed.hostname } }
}
