import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFS, PROFILE_KEYS, buildNewProfile } from './profile'

describe('buildNewProfile', () => {
  const createdAt = { marca: 'serverTimestamp' }

  it('crea siempre un perfil pendiente y sin admin', () => {
    const profile = buildNewProfile(
      {
        email: 'ana@ejemplo.com',
        displayName: 'Ana',
        photoURL: null,
        providerData: [{ providerId: 'password' }],
      },
      createdAt,
    )
    expect(profile.status).toBe('pending')
    expect(profile.admin).toBe(false)
    expect(profile.approvedAt).toBeNull()
    expect(profile.createdAt).toBe(createdAt)
    expect(profile.prefs).toEqual(DEFAULT_PREFS)
    expect(Object.keys(profile).sort()).toEqual([...PROFILE_KEYS].sort())
  })

  it('usa el principio del correo si no hay nombre y guarda el proveedor', () => {
    const profile = buildNewProfile(
      {
        email: 'ana@ejemplo.com',
        displayName: '  ',
        photoURL: 'https://foto',
        providerData: [{ providerId: 'google.com' }],
      },
      createdAt,
    )
    expect(profile.displayName).toBe('ana')
    expect(profile.provider).toBe('google.com')
    expect(profile.photoURL).toBe('https://foto')
  })
})
