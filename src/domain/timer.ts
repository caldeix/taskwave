import { addDays, startOfDay } from 'date-fns'
import { toDayKey, type DayKey } from './dates'

/**
 * Cronómetro (step-19, D-25 a D-28): uno solo, guardado en el perfil (`activeTimer`) con la
 * hora del servidor. Al pararlo se crea un registro de horas por día (D-27) y se suman las horas
 * a la tarea. Lógica pura: las escrituras están en `src/data/timer.ts`.
 *
 * Los días van en hora local, como el resto de la app (calendario, «hoy»).
 */

export interface TimerSegment {
  date: DayKey
  startMs: number
  endMs: number
  minutes: number
}

/** Un registro es como mucho de un día (reglas: 1 a 1440 minutos). */
export const MAX_SEGMENT_MINUTES = 1440

/**
 * Parte el tiempo entre `startMs` y `endMs` en un tramo por día, cortando a medianoche (D-27).
 * Los minutos se redondean; los tramos de menos de medio minuto no se registran.
 */
export function splitByDay(startMs: number, endMs: number): TimerSegment[] {
  const segments: TimerSegment[] = []
  let from = startMs
  while (from < endMs) {
    const midnight = addDays(startOfDay(new Date(from)), 1).getTime()
    const to = Math.min(midnight, endMs)
    const minutes = Math.min(Math.round((to - from) / 60_000), MAX_SEGMENT_MINUTES)
    if (minutes > 0)
      segments.push({ date: toDayKey(new Date(from)), startMs: from, endMs: to, minutes })
    from = to
  }
  return segments
}

export function totalMinutes(segments: TimerSegment[]): number {
  return segments.reduce((sum, s) => sum + s.minutes, 0)
}

/** «5:07» (minutos y segundos) o «1:05:07» desde una hora. */
export function formatClock(elapsedMs: number): string {
  const total = Math.max(0, Math.floor(elapsedMs / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

/** Aviso de cronómetro olvidado (D-28): a partir de `warnHours` (8 por defecto). */
export function isOverWarning(elapsedMs: number, warnHours: number): boolean {
  return elapsedMs >= warnHours * 3_600_000
}

export type StopError = 'beforeStart' | 'inFuture'

/**
 * Valida la hora de fin elegida al parar un cronómetro olvidado (D-28): no antes de que
 * empezara ni después de ahora (con un minuto de margen por los relojes).
 */
export function validateStopAt(startMs: number, endMs: number, nowMs: number): StopError | null {
  if (endMs <= startMs) return 'beforeStart'
  if (endMs > nowMs + 60_000) return 'inFuture'
  return null
}

/** Hora de fin real: nunca antes del inicio (el reloj del equipo puede ir algo atrasado). */
export function clampStop(startMs: number, endMs: number): number {
  return Math.max(startMs, endMs)
}
