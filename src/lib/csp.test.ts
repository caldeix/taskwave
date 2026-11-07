import { describe, expect, it } from 'vitest'
import { buildCsp, inlineScripts } from './csp'

describe('buildCsp (step-27, R-3)', () => {
  const csp = buildCsp({ authDomain: 'proyecto.firebaseapp.com', scriptHashes: ['sha256-abc='] })
  const directive = (name: string) => csp.split('; ').find((d) => d.startsWith(`${name} `)) ?? ''

  it('solo scripts propios, los en línea por hash y los de Google necesarios', () => {
    expect(directive('script-src')).toBe(
      "script-src 'self' 'sha256-abc=' https://apis.google.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/",
    )
    expect(csp).not.toContain("'unsafe-inline' https://apis")
    expect(directive('script-src')).not.toContain('unsafe')
  })

  it('el login se hace en el iframe del dominio de Auth', () => {
    expect(directive('frame-src')).toContain('https://proyecto.firebaseapp.com')
  })

  it('cierra lo que no se usa', () => {
    expect(directive('object-src')).toBe("object-src 'none'")
    expect(directive('base-uri')).toBe("base-uri 'self'")
    expect(directive('default-src')).toBe("default-src 'self'")
  })

  it('sin dominio de Auth no deja huecos en la política', () => {
    expect(buildCsp({ authDomain: '', scriptHashes: [] })).not.toMatch(/ {2}|frame-src ;/)
  })
})

describe('inlineScripts', () => {
  it('devuelve solo los scripts en línea, no los que tienen src', () => {
    const html =
      '<script>var a = 1</script><script type="module" src="/x.js"></script><script>\n</script>'
    expect(inlineScripts(html)).toEqual(['var a = 1'])
  })
})
