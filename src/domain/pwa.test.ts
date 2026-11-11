import { describe, expect, it } from 'vitest'
import { UPDATE_CHECK_GAP_MS, shouldCheckForUpdate } from './pwa'

const onScreen = { visible: true, online: true }

describe('shouldCheckForUpdate (v1.3.2)', () => {
  it('busca la primera vez y luego como mucho una vez cada 5 minutos', () => {
    expect(shouldCheckForUpdate(null, 1000, onScreen)).toBe(true)
    expect(shouldCheckForUpdate(1000, 1000 + UPDATE_CHECK_GAP_MS - 1, onScreen)).toBe(false)
    expect(shouldCheckForUpdate(1000, 1000 + UPDATE_CHECK_GAP_MS, onScreen)).toBe(true)
  })

  it('no busca con la pestaña oculta ni sin conexión', () => {
    expect(shouldCheckForUpdate(null, 1000, { visible: false, online: true })).toBe(false)
    expect(shouldCheckForUpdate(null, 1000, { visible: true, online: false })).toBe(false)
  })
})
