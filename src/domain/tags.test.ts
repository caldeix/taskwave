import { describe, expect, it } from 'vitest'
import {
  MAX_TAG_NAME,
  findTagByName,
  nextTagColor,
  normalizeTagName,
  suggestTags,
  tagsOf,
  validateTagName,
  type Tag,
} from './tags'

const tags: Tag[] = [
  { id: 'u', name: 'Universidad', color: 'blue' },
  { id: 'r', name: 'Urgente', color: 'coral' },
  { id: 'c', name: 'Casa', color: 'emerald' },
  { id: 'l', name: 'Lectura rápida', color: 'violet' },
]

describe('normalizeTagName y validateTagName (D-40)', () => {
  it('quita los espacios sobrantes', () => {
    expect(normalizeTagName('  Uni   2026 ')).toBe('Uni 2026')
  })

  it('exige un nombre corto y que no se repita sin mirar mayúsculas ni tildes', () => {
    expect(validateTagName('   ', tags)).toBe('required')
    expect(validateTagName('x'.repeat(MAX_TAG_NAME + 1), tags)).toBe('tooLong')
    expect(validateTagName('x'.repeat(MAX_TAG_NAME), tags)).toBeNull()
    expect(validateTagName('universidad', tags)).toBe('duplicate')
    expect(validateTagName('LECTURA RAPIDA', tags)).toBe('duplicate')
    expect(validateTagName('Trabajo', tags)).toBeNull()
  })

  it('al renombrar, el propio tag no cuenta como repetido', () => {
    expect(validateTagName('universidad', tags, 'u')).toBeNull()
    expect(validateTagName('Casa', tags, 'u')).toBe('duplicate')
  })
})

describe('suggestTags', () => {
  it('primero los que empiezan por el texto, luego los que lo contienen', () => {
    expect(suggestTags(tags, 'u', []).map((t) => t.id)).toEqual(['u', 'r', 'l'])
    expect(suggestTags(tags, 'RAPI', []).map((t) => t.id)).toEqual(['l'])
  })

  it('sin texto, todos por orden alfabético; nunca los ya elegidos', () => {
    expect(suggestTags(tags, '', ['c']).map((t) => t.name)).toEqual([
      'Lectura rápida',
      'Universidad',
      'Urgente',
    ])
    expect(suggestTags(tags, 'u', ['u'], 1).map((t) => t.id)).toEqual(['r'])
  })
})

describe('findTagByName, nextTagColor y tagsOf', () => {
  it('encuentra un tag por su nombre exacto sin mirar tildes', () => {
    expect(findTagByName(tags, ' lectura  rapida ')?.id).toBe('l')
    expect(findTagByName(tags, 'lect')).toBeUndefined()
    expect(findTagByName(tags, '')).toBeUndefined()
  })

  it('el color nuevo es el menos usado', () => {
    expect(nextTagColor([])).toBe('blue')
    expect(nextTagColor(tags)).toBe('mustard')
  })

  it('devuelve los tags de una tarea ordenados e ignora los borrados', () => {
    expect(tagsOf(['u', 'borrado', 'c'], tags).map((t) => t.name)).toEqual(['Casa', 'Universidad'])
  })
})
