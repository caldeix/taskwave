import type { UserStatus } from './profile'

/**
 * Decide a dónde puede ir el usuario según su sesión y su estado (step-4 y step-5).
 * Solo afecta a la experiencia de uso: la seguridad real está en las reglas de Firestore.
 */

export type AccessRoute = 'login' | 'verify-email' | 'pending' | 'blocked' | 'home'

export interface AccessState {
  loggedIn: boolean
  mustVerifyEmail: boolean
  /** `null` mientras no hay perfil (sin sesión o sin verificar). `error` si no se pudo cargar. */
  status: UserStatus | 'error' | null
}

export interface RouteAccess {
  name: string | null | undefined
  /** Solo sin sesión (login, registro, recuperar). */
  guest?: boolean
  /** Requiere una cuenta activa. */
  requiresAuth?: boolean
  /** Pantallas de cuenta (verificar, pendiente, bloqueado): requieren sesión. */
  requiresSession?: boolean
}

/** Ruta en la que debe estar un usuario con sesión, según su estado. */
export function homeFor(state: AccessState): AccessRoute {
  if (state.mustVerifyEmail) return 'verify-email'
  if (state.status === 'active') return 'home'
  if (state.status === 'blocked') return 'blocked'
  return 'pending' // pending o error al cargar el perfil
}

/** Devuelve `null` si puede entrar en la ruta, o el nombre de la ruta a la que redirigir. */
export function resolveAccess(state: AccessState, route: RouteAccess): AccessRoute | null {
  if (!state.loggedIn) {
    return route.requiresAuth || route.requiresSession ? 'login' : null
  }
  const target = homeFor(state)
  if (route.requiresSession) return route.name === target ? null : target
  if (route.guest) return target
  if (route.requiresAuth) return target === 'home' ? null : target
  return null // rutas públicas (página no encontrada)
}
