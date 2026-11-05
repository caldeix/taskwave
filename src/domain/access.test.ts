import { describe, expect, it } from 'vitest'
import { resolveAccess, type AccessState } from './access'

const anon: AccessState = { loggedIn: false, mustVerifyEmail: false, status: null }
const unverified: AccessState = { loggedIn: true, mustVerifyEmail: true, status: null }
const pending: AccessState = { loggedIn: true, mustVerifyEmail: false, status: 'pending' }
const active: AccessState = { loggedIn: true, mustVerifyEmail: false, status: 'active' }
const blocked: AccessState = { loggedIn: true, mustVerifyEmail: false, status: 'blocked' }
const failed: AccessState = { loggedIn: true, mustVerifyEmail: false, status: 'error' }

const app = { name: 'home', requiresAuth: true }
const login = { name: 'login', guest: true }
const verify = { name: 'verify-email', requiresSession: true }
const pendingRoute = { name: 'pending', requiresSession: true }
const blockedRoute = { name: 'blocked', requiresSession: true }
const notFound = { name: 'not-found' }

describe('resolveAccess', () => {
  it('sin sesión solo deja las rutas públicas y de invitado', () => {
    expect(resolveAccess(anon, login)).toBeNull()
    expect(resolveAccess(anon, notFound)).toBeNull()
    expect(resolveAccess(anon, app)).toBe('login')
    expect(resolveAccess(anon, pendingRoute)).toBe('login')
  })

  it('con el correo sin verificar, solo la pantalla de verificación', () => {
    expect(resolveAccess(unverified, verify)).toBeNull()
    expect(resolveAccess(unverified, app)).toBe('verify-email')
    expect(resolveAccess(unverified, pendingRoute)).toBe('verify-email')
  })

  it('un usuario pendiente solo ve «pendiente»', () => {
    expect(resolveAccess(pending, pendingRoute)).toBeNull()
    expect(resolveAccess(pending, app)).toBe('pending')
    expect(resolveAccess(pending, login)).toBe('pending')
    expect(resolveAccess(pending, blockedRoute)).toBe('pending')
  })

  it('un usuario bloqueado solo ve «bloqueado»', () => {
    expect(resolveAccess(blocked, blockedRoute)).toBeNull()
    expect(resolveAccess(blocked, app)).toBe('blocked')
    expect(resolveAccess(blocked, pendingRoute)).toBe('blocked')
  })

  it('un usuario activo entra en la app y sale de las pantallas de cuenta', () => {
    expect(resolveAccess(active, app)).toBeNull()
    expect(resolveAccess(active, login)).toBe('home')
    expect(resolveAccess(active, verify)).toBe('home')
    expect(resolveAccess(active, pendingRoute)).toBe('home')
    expect(resolveAccess(active, notFound)).toBeNull()
  })

  it('si el perfil no se pudo cargar, se trata como pendiente (sin acceso a la app)', () => {
    expect(resolveAccess(failed, app)).toBe('pending')
  })

  it('el panel de admin solo lo ve un admin activo', () => {
    const adminRoute = { name: 'admin-users', requiresAdmin: true }
    expect(resolveAccess({ ...active, isAdmin: true }, adminRoute)).toBeNull()
    expect(resolveAccess(active, adminRoute)).toBe('home')
    expect(resolveAccess(pending, adminRoute)).toBe('pending')
    expect(resolveAccess(blocked, adminRoute)).toBe('blocked')
    expect(resolveAccess(anon, adminRoute)).toBe('login')
  })
})
