import { describe, expect, it } from 'vitest'
import { MAX_COMMENT, commentFromData, normalizeCommentBody, validateComment } from './comments'

const ts = (ms: number) => ({ toMillis: () => ms })

describe('commentFromData', () => {
  it('convierte las marcas de tiempo y tolera campos que falten', () => {
    expect(
      commentFromData('c1', { body: 'hola', createdAt: ts(1000), editedAt: ts(2000) }),
    ).toEqual({ id: 'c1', body: 'hola', createdAtMs: 1000, editedAtMs: 2000 })
    expect(commentFromData('c2', { editedAt: null })).toEqual({
      id: 'c2',
      body: '',
      createdAtMs: null,
      editedAtMs: null,
    })
  })
})

describe('validateComment', () => {
  it('no admite comentarios vacíos ni demasiado largos', () => {
    expect(validateComment('  \n ')).toBe('required')
    expect(validateComment('x'.repeat(MAX_COMMENT + 1))).toBe('tooLong')
    expect(validateComment('x'.repeat(MAX_COMMENT) + '\n\n')).toBeNull()
    expect(validateComment('Listo')).toBeNull()
  })

  it('quita lo que sobra al final pero respeta la sangría del principio', () => {
    expect(normalizeCommentBody('    código\n\n  ')).toBe('    código')
  })
})
