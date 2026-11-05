import { describe, expect, it } from 'vitest'
import { computeProgress, normalizeDates, validateDates, validateWebLink } from './taskEdit'

describe('validateDates y normalizeDates', () => {
  it('fechas opcionales, fin no anterior y no sin inicio', () => {
    expect(validateDates(null, null)).toBeNull()
    expect(validateDates('2026-11-05', null)).toBeNull()
    expect(validateDates('2026-11-05', '2026-11-07')).toBeNull()
    expect(validateDates(null, '2026-11-07')).toBe('tasks.validation.endWithoutStart')
    expect(validateDates('2026-11-05', '2026-11-01')).toBe('tasks.validation.endBeforeStart')
    expect(validateDates('2026-11-31', null)).toBe('tasks.validation.dateInvalid')
  })

  it('un fin igual al inicio se guarda como tarea de un día', () => {
    expect(normalizeDates('2026-11-05', '2026-11-05')).toEqual({
      startDate: '2026-11-05',
      endDate: null,
    })
  })
})

describe('computeProgress (D-31)', () => {
  it('sin estimado no hay porcentaje', () => {
    expect(computeProgress(240, null)).toMatchObject({ hasEstimate: false, percent: null })
  })

  it('dentro del estimado: verde sobre amarillo', () => {
    expect(computeProgress(240, 1200)).toEqual({
      hasEstimate: true,
      percent: 20,
      spentWidth: 20,
      estimateWidth: 100,
      excessWidth: 0,
      excessMin: 0,
    })
  })

  it('pasado del estimado: el exceso va en coral', () => {
    const p = computeProgress(1440, 1200) // 24h de 20h
    expect(p.percent).toBe(120)
    expect(p.excessMin).toBe(240)
    expect(p.estimateWidth).toBeCloseTo(83.33, 1)
    expect(p.spentWidth + p.excessWidth).toBeCloseTo(100)
  })
})

describe('validateWebLink (D-45)', () => {
  it('acepta http y https, y añade https si falta', () => {
    expect(validateWebLink('https://vuejs.org/guide', 'Guía', [])).toEqual({
      link: { url: 'https://vuejs.org/guide', title: 'Guía' },
    })
    expect(validateWebLink('example.com', '', [])).toEqual({
      link: { url: 'https://example.com/', title: 'example.com' },
    })
  })

  it('rechaza esquemas peligrosos y textos que no son URL (XSS)', () => {
    expect(validateWebLink('javascript:alert(1)', '', [])).toEqual({
      error: 'taskView.links.invalid',
    })
    expect(validateWebLink('data:text/html,<b>x</b>', '', [])).toEqual({
      error: 'taskView.links.invalid',
    })
    expect(validateWebLink('hola', '', [])).toEqual({ error: 'taskView.links.invalid' })
    expect(validateWebLink('', '', [])).toEqual({ error: 'taskView.links.invalid' })
  })

  it('no repite enlaces y limita a 20', () => {
    const one = [{ url: 'https://a.com/', title: 'a' }]
    expect(validateWebLink('https://a.com', '', one)).toEqual({ error: 'taskView.links.duplicate' })
    const many = Array.from({ length: 20 }, (_, i) => ({ url: `https://${i}.com/`, title: '' }))
    expect(validateWebLink('https://b.com', '', many)).toEqual({ error: 'taskView.links.tooMany' })
  })
})
