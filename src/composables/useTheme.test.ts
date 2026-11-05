import { describe, expect, it } from 'vitest'
import { resolveIsDark } from './useTheme'

describe('resolveIsDark', () => {
  it('respeta la elección explícita del usuario', () => {
    expect(resolveIsDark('dark', false)).toBe(true)
    expect(resolveIsDark('light', true)).toBe(false)
  })

  it('en modo sistema sigue la preferencia del sistema operativo', () => {
    expect(resolveIsDark('system', true)).toBe(true)
    expect(resolveIsDark('system', false)).toBe(false)
  })
})
