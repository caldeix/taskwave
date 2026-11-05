import type { Ref } from 'vue'

/**
 * Formato de markdown sobre la selección de un textarea (barra y atajos del editor, D-43).
 * Usa `setRangeText`, así que Ctrl+Z deshace el cambio como si se hubiera escrito a mano.
 */
export type MarkdownAction =
  'bold' | 'italic' | 'heading' | 'list' | 'checklist' | 'quote' | 'code' | 'link'

const WRAPS: Partial<Record<MarkdownAction, [string, string, string]>> = {
  bold: ['**', '**', 'negrita'],
  italic: ['_', '_', 'cursiva'],
  code: ['`', '`', 'código'],
}

const LINE_PREFIX: Partial<Record<MarkdownAction, string>> = {
  heading: '## ',
  list: '- ',
  checklist: '- [ ] ',
  quote: '> ',
}

export function useMarkdownShortcuts(
  textarea: Ref<HTMLTextAreaElement | null>,
  update: (value: string) => void,
) {
  function apply(action: MarkdownAction): void {
    const el = textarea.value
    if (!el) return
    const { selectionStart: start, selectionEnd: end, value } = el
    const selected = value.slice(start, end)

    if (action === 'link') {
      const text = selected || 'texto'
      el.setRangeText(`[${text}](https://)`, start, end, 'end')
      // Deja seleccionado «https://» para escribir la dirección.
      const urlStart = start + text.length + 3
      el.setSelectionRange(urlStart, urlStart + 8)
    } else if (WRAPS[action]) {
      const [before, after, placeholder] = WRAPS[action]!
      const text = selected || placeholder
      el.setRangeText(`${before}${text}${after}`, start, end, 'select')
      el.setSelectionRange(start + before.length, start + before.length + text.length)
    } else {
      // Prefijo al principio de cada línea seleccionada.
      const prefix = LINE_PREFIX[action]!
      const lineStart = value.lastIndexOf('\n', start - 1) + 1
      const block = value.slice(lineStart, end)
      const prefixed = block
        .split('\n')
        .map((line) => (line.startsWith(prefix) ? line : prefix + line))
        .join('\n')
      el.setRangeText(prefixed, lineStart, end, 'end')
    }
    el.focus()
    update(el.value)
  }

  /** Atajos: Ctrl/Cmd + B (negrita), I (cursiva), K (enlace). */
  function onKeydown(event: KeyboardEvent): boolean {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return false
    const key = event.key.toLowerCase()
    const action = key === 'b' ? 'bold' : key === 'i' ? 'italic' : key === 'k' ? 'link' : null
    if (!action) return false
    event.preventDefault()
    apply(action)
    return true
  }

  return { apply, onKeydown }
}
