/**
 * Lógica pura de autenticación (sin Firebase), para poder testearla aparte.
 */

/** Longitud mínima de contraseña de TaskWave (Firebase exige 6; pedimos algo más). */
export const MIN_PASSWORD_LENGTH = 8

/** Claves i18n de `auth.errors.*` para los códigos de error de Firebase Auth. */
const ERROR_KEYS: Record<string, string> = {
  'auth/invalid-credential': 'invalidCredential',
  'auth/wrong-password': 'invalidCredential',
  'auth/user-not-found': 'invalidCredential',
  'auth/invalid-email': 'invalidEmail',
  'auth/email-already-in-use': 'emailInUse',
  'auth/weak-password': 'weakPassword',
  'auth/too-many-requests': 'tooManyRequests',
  'auth/network-request-failed': 'network',
  'auth/user-disabled': 'userDisabled',
  'auth/popup-closed-by-user': 'popupClosed',
  'auth/cancelled-popup-request': 'popupClosed',
  'auth/popup-blocked': 'popupBlocked',
  'auth/account-exists-with-different-credential': 'differentCredential',
  'auth/requires-recent-login': 'recentLogin',
}

/** Devuelve la clave i18n completa para un error de Firebase Auth (o la genérica). */
export function authErrorKey(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : ''
  return `auth.errors.${ERROR_KEYS[code] ?? 'generic'}`
}

/**
 * Al recuperar la contraseña, «no existe ese usuario» se trata como éxito: así no se revela
 * qué correos están registrados (Firebase lo hace en producción con la protección contra
 * enumeración de correos, pero el emulador sí devuelve el error).
 */
export function isUserNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'auth/user-not-found'
  )
}

/** Errores que no hace falta mostrar (el usuario cerró la ventana de Google). */
export function isSilentAuthError(error: unknown): boolean {
  return authErrorKey(error) === 'auth.errors.popupClosed'
}

/**
 * Devuelve la ruta interna a la que volver tras el login, o `null` si no es segura.
 * Solo se aceptan rutas internas (`/algo`), nunca URLs absolutas ni `//dominio` (open redirect).
 */
export function safeRedirect(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null
  // Sin caracteres de control (saltos de línea, tabuladores…)
  if ([...value].some((ch) => ch.charCodeAt(0) < 0x20)) return null
  return value
}

export interface RegisterInput {
  name: string
  email: string
  password: string
  confirm: string
}

export type RegisterErrors = Partial<Record<keyof RegisterInput, string>>

/** Valida el formulario de registro. Devuelve claves i18n por campo. */
export function validateRegister(input: RegisterInput): RegisterErrors {
  const errors: RegisterErrors = {}
  if (!input.name.trim()) errors.name = 'auth.validation.nameRequired'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()))
    errors.email = 'auth.validation.emailInvalid'
  if (input.password.length < MIN_PASSWORD_LENGTH) errors.password = 'auth.validation.passwordShort'
  if (input.confirm !== input.password) errors.confirm = 'auth.validation.passwordMismatch'
  return errors
}

/**
 * ¿Necesita verificar el correo? Solo las cuentas de correo y contraseña sin verificar (D-6).
 * Las de Google ya llegan verificadas.
 */
export function needsEmailVerification(user: {
  emailVerified: boolean
  providerData: { providerId: string }[]
}): boolean {
  const isPassword = user.providerData.some((p) => p.providerId === 'password')
  return isPassword && !user.emailVerified
}
