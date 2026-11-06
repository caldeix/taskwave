/**
 * Atajos de teclado (step-24, D-52):
 * - `Ctrl+K` (o `Cmd+K`) y `/`: buscar.
 * - `N`: nueva tarea.
 * - `C` / `K`: calendario / kanban.
 * Las letras no hacen nada mientras se escribe (campos, áreas de texto, contenido editable) ni
 * con otras teclas modificadoras, para no pisar los atajos del navegador ni los del editor.
 */

export type ShortcutAction = 'search' | 'newTask' | 'calendar' | 'kanban'

export interface KeyLike {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
  repeat?: boolean
}

/** ¿Está el foco en algo donde se escribe? */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || typeof el.tagName !== 'string') return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'textarea' || tag === 'select') return true
  if (tag === 'input') {
    const type = ((el as HTMLInputElement).type || 'text').toLowerCase()
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color'].includes(type)
  }
  return el.isContentEditable === true
}

export function shortcutAction(event: KeyLike, typing: boolean): ShortcutAction | null {
  if (event.repeat) return null
  const key = event.key.toLowerCase()
  // Ctrl+K funciona también escribiendo (como en la mayoría de apps).
  if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && key === 'k')
    return 'search'
  if (typing || event.ctrlKey || event.metaKey || event.altKey) return null
  if (key === '/') return 'search'
  if (event.shiftKey) return null
  if (key === 'n') return 'newTask'
  if (key === 'c') return 'calendar'
  if (key === 'k') return 'kanban'
  return null
}
