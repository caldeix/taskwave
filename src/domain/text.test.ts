import { describe, expect, it } from 'vitest'
import { fold, matchesWords } from './text'

describe('fold y matchesWords', () => {
  it('compara sin mayúsculas ni tildes', () => {
    expect(fold('Árbol ÑANDÚ')).toBe('arbol nandu')
  })

  it('todas las palabras tienen que aparecer, en cualquier orden', () => {
    expect(matchesWords('Estudiar tema de Álgebra', 'algebra tema')).toBe(true)
    expect(matchesWords('Estudiar tema de Álgebra', 'algebra redes')).toBe(false)
    expect(matchesWords('Lo que sea', '   ')).toBe(false)
  })
})
