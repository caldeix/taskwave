import { describe, expect, it } from 'vitest'
import {
  authErrorKey,
  isSilentAuthError,
  isUserNotFound,
  needsEmailVerification,
  safeRedirect,
  validateRegister,
} from './auth'

describe('authErrorKey', () => {
  it('traduce los códigos conocidos', () => {
    expect(authErrorKey({ code: 'auth/invalid-credential' })).toBe('auth.errors.invalidCredential')
    expect(authErrorKey({ code: 'auth/email-already-in-use' })).toBe('auth.errors.emailInUse')
  })

  it('usa el mensaje genérico para lo desconocido', () => {
    expect(authErrorKey({ code: 'auth/otra-cosa' })).toBe('auth.errors.generic')
    expect(authErrorKey(new Error('x'))).toBe('auth.errors.generic')
    expect(authErrorKey(null)).toBe('auth.errors.generic')
  })

  it('detecta «usuario no encontrado» para no revelar qué correos existen', () => {
    expect(isUserNotFound({ code: 'auth/user-not-found' })).toBe(true)
    expect(isUserNotFound({ code: 'auth/invalid-email' })).toBe(false)
    expect(isUserNotFound(null)).toBe(false)
  })

  it('cerrar la ventana de Google no es un error que mostrar', () => {
    expect(isSilentAuthError({ code: 'auth/popup-closed-by-user' })).toBe(true)
    expect(isSilentAuthError({ code: 'auth/invalid-credential' })).toBe(false)
  })
})

describe('safeRedirect', () => {
  it('acepta rutas internas', () => {
    expect(safeRedirect('/t/EST-12')).toBe('/t/EST-12')
    expect(safeRedirect('/?vista=kanban')).toBe('/?vista=kanban')
  })

  it('rechaza redirecciones a otros dominios o valores raros', () => {
    expect(safeRedirect('https://malo.com')).toBeNull()
    expect(safeRedirect('//malo.com')).toBeNull()
    expect(safeRedirect('/\\malo.com')).toBeNull()
    expect(safeRedirect('javascript:alert(1)')).toBeNull()
    expect(safeRedirect('/a\nb')).toBeNull()
    expect(safeRedirect(['/a'])).toBeNull()
    expect(safeRedirect(undefined)).toBeNull()
  })
})

describe('validateRegister', () => {
  const ok = { name: 'Ana', email: 'ana@ejemplo.com', password: '12345678', confirm: '12345678' }

  it('acepta un formulario correcto', () => {
    expect(validateRegister(ok)).toEqual({})
  })

  it('marca cada campo incorrecto', () => {
    expect(validateRegister({ name: ' ', email: 'ana', password: '123', confirm: '12' })).toEqual({
      name: 'auth.validation.nameRequired',
      email: 'auth.validation.emailInvalid',
      password: 'auth.validation.passwordShort',
      confirm: 'auth.validation.passwordMismatch',
    })
  })
})

describe('needsEmailVerification', () => {
  it('solo las cuentas de correo sin verificar', () => {
    expect(
      needsEmailVerification({ emailVerified: false, providerData: [{ providerId: 'password' }] }),
    ).toBe(true)
    expect(
      needsEmailVerification({ emailVerified: true, providerData: [{ providerId: 'password' }] }),
    ).toBe(false)
    expect(
      needsEmailVerification({
        emailVerified: false,
        providerData: [{ providerId: 'google.com' }],
      }),
    ).toBe(false)
  })
})
