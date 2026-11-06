import { describe, expect, it } from 'vitest'
import { isTypingTarget, shortcutAction, type KeyLike } from './shortcuts'

const key = (k: string, extra: Partial<KeyLike> = {}): KeyLike => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...extra,
})

describe('shortcutAction (D-52)', () => {
  it('letras sueltas: N, C, K y /', () => {
    expect(shortcutAction(key('n'), false)).toBe('newTask')
    expect(shortcutAction(key('C'), false)).toBe('calendar')
    expect(shortcutAction(key('k'), false)).toBe('kanban')
    expect(shortcutAction(key('/'), false)).toBe('search')
    expect(shortcutAction(key('x'), false)).toBeNull()
  })

  it('Ctrl+K o Cmd+K buscan, incluso escribiendo', () => {
    expect(shortcutAction(key('k', { ctrlKey: true }), false)).toBe('search')
    expect(shortcutAction(key('K', { metaKey: true }), true)).toBe('search')
    expect(shortcutAction(key('k', { ctrlKey: true, shiftKey: true }), false)).toBeNull()
  })

  it('escribiendo, con modificadores o con la tecla pulsada, las letras no hacen nada', () => {
    expect(shortcutAction(key('n'), true)).toBeNull()
    expect(shortcutAction(key('/'), true)).toBeNull()
    expect(shortcutAction(key('n', { ctrlKey: true }), false)).toBeNull() // Ctrl+N del navegador
    expect(shortcutAction(key('c', { altKey: true }), false)).toBeNull()
    expect(shortcutAction(key('N', { shiftKey: true }), false)).toBeNull()
    expect(shortcutAction(key('n', { repeat: true }), false)).toBeNull()
  })
})

describe('isTypingTarget', () => {
  it('campos de texto, áreas, selectores y contenido editable', () => {
    const input = document.createElement('input')
    const checkbox = Object.assign(document.createElement('input'), { type: 'checkbox' })
    const div = document.createElement('div')
    const editable = document.createElement('div')
    Object.defineProperty(editable, 'isContentEditable', { value: true })
    expect(isTypingTarget(input)).toBe(true)
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true)
    expect(isTypingTarget(document.createElement('select'))).toBe(true)
    expect(isTypingTarget(editable)).toBe(true)
    expect(isTypingTarget(checkbox)).toBe(false)
    expect(isTypingTarget(div)).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})
