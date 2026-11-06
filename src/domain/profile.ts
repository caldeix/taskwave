/**
 * Perfil de usuario en `users/{uid}` (apartado «Impacto en BD» del plan, D-2).
 * El estado y el flag de admin solo los cambian el admin (estado) o la consola de Firebase
 * (admin); las reglas de Firestore lo garantizan.
 */

export const USER_STATUSES = ['pending', 'active', 'blocked'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

export type ThemePref = 'light' | 'dark' | 'system'

export interface UserPrefs {
  theme: ThemePref
  view: 'calendar' | 'kanban'
  sidebarCollapsed: boolean
  /** Franja de tareas iniciadas plegada (step-21, D-34). */
  startedCollapsed: boolean
  /** Horas de una jornada para el «1d» de las duraciones (P-8). */
  hoursPerDay: number
  /** Aviso del cronómetro olvidado, en horas (D-28). */
  timerWarnHours: number
  /** Filtros guardados (D-38); se definen en el step-13. */
  filters: Record<string, unknown> | null
}

export interface ActiveTimer {
  taskId: string
  startedAt: unknown
}

/** Campos del documento. Las fechas son `Timestamp` de Firestore (se tipan como `unknown` aquí). */
export interface UserProfile {
  email: string
  displayName: string
  photoURL: string | null
  provider: string
  status: UserStatus
  admin: boolean
  createdAt: unknown
  approvedAt: unknown | null
  approvedBy: string | null
  inboxCounter: number
  prefs: UserPrefs
  activeTimer: ActiveTimer | null
}

/** Campos permitidos en el documento (las reglas usan la misma lista). */
export const PROFILE_KEYS = [
  'email',
  'displayName',
  'photoURL',
  'provider',
  'status',
  'admin',
  'createdAt',
  'approvedAt',
  'approvedBy',
  'inboxCounter',
  'prefs',
  'activeTimer',
] as const satisfies readonly (keyof UserProfile)[]

export const DEFAULT_PREFS: UserPrefs = {
  theme: 'system',
  view: 'calendar',
  sidebarCollapsed: false,
  startedCollapsed: false,
  hoursPerDay: 8,
  timerWarnHours: 8,
  filters: null,
}

export const MAX_DISPLAY_NAME = 100

interface AuthUserLike {
  email: string | null
  displayName: string | null
  photoURL: string | null
  providerData: { providerId: string }[]
}

/**
 * Perfil inicial al primer acceso: siempre `pending` y sin admin (las reglas lo exigen).
 * `createdAt` lo pone quien llama con `serverTimestamp()`.
 */
export function buildNewProfile(user: AuthUserLike, createdAt: unknown): UserProfile {
  const email = user.email ?? ''
  const fallbackName = email.split('@')[0] ?? ''
  return {
    email,
    displayName: (user.displayName?.trim() || fallbackName).slice(0, MAX_DISPLAY_NAME),
    photoURL: user.photoURL ?? null,
    provider: user.providerData[0]?.providerId ?? 'password',
    status: 'pending',
    admin: false,
    createdAt,
    approvedAt: null,
    approvedBy: null,
    inboxCounter: 0,
    prefs: { ...DEFAULT_PREFS },
    activeTimer: null,
  }
}
