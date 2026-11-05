import MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import DOMPurify from 'dompurify'

/**
 * Markdown de descripciones y comentarios (step-15, D-43, CA-10).
 *
 * Seguridad (XSS, R-3), en dos capas:
 * 1. markdown-it con `html: false`: el HTML escrito a mano se muestra como texto, nunca se
 *    interpreta; y su `validateLink` ya descarta `javascript:`, `vbscript:`, `file:` y `data:`.
 * 2. DOMPurify sobre el resultado, por si acaso: quita scripts, manejadores `on*`, `style` y
 *    cualquier URL peligrosa que se colara.
 * Los enlaces se abren en otra pestaña con `rel="noopener noreferrer nofollow"`.
 */

const md = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: false })

/**
 * Checklists `- [ ]` / `- [x]`: cada casilla lleva `data-line` con la línea del texto fuente,
 * para poder marcarla desde la vista de lectura sin depender del orden (ver `toggleChecklistLine`).
 */
md.core.ruler.after('inline', 'task-lists', (state) => {
  const tokens = state.tokens
  for (let i = 2; i < tokens.length; i++) {
    const inline = tokens[i]!
    const paragraph = tokens[i - 1]!
    const item = tokens[i - 2]!
    if (
      inline.type !== 'inline' ||
      paragraph.type !== 'paragraph_open' ||
      item.type !== 'list_item_open'
    )
      continue
    const match = /^\[([ xX])\]\s+/.exec(inline.content)
    const first = inline.children?.[0]
    if (!match || !first || first.type !== 'text' || !item.map) continue

    const checked = match[1] !== ' '
    first.content = first.content.replace(/^\[[ xX]\]\s+/, '')
    const checkbox = new state.Token('html_inline', '', 0) as Token
    checkbox.content = `<input type="checkbox" class="md-task" data-line="${item.map[0]}"${checked ? ' checked' : ''}> `
    inline.children!.unshift(checkbox)
    item.attrJoin('class', 'md-task-item')
  }
})

// Enlaces externos en otra pestaña y sin pasar el origen.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer nofollow')
  }
})

const SANITIZE = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'hr',
    'strong',
    'em',
    's',
    'code',
    'pre',
    'blockquote',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'ul',
    'ol',
    'li',
    'a',
    'img',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'input',
  ],
  ALLOWED_ATTR: [
    'href',
    'title',
    'src',
    'alt',
    'class',
    'type',
    'checked',
    'data-line',
    'start',
    'align',
  ],
  ALLOW_DATA_ATTR: false,
  // Solo http(s) y mailto en enlaces e imágenes (D-44: sin subidas).
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
  // DOMPurify aplica esa regla a todos los atributos salvo a los «seguros»: sin esto quitaría
  // `type="checkbox"` y `data-line` de las casillas.
  ADD_URI_SAFE_ATTR: ['type', 'data-line', 'start', 'align'],
}

/** Markdown → HTML seguro para `v-html`. */
export function renderMarkdown(source: string): string {
  return DOMPurify.sanitize(md.render(source), SANITIZE)
}

/**
 * Marca o desmarca la casilla de la línea `line` (0 = primera) del texto fuente.
 * Devuelve el texto nuevo, o el mismo si esa línea no tiene casilla.
 */
export function toggleChecklistLine(source: string, line: number): string {
  const lines = source.split('\n')
  const current = lines[line]
  if (current === undefined) return source
  const toggled = current.replace(
    /^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\]/,
    (_, prefix: string, mark: string) => `${prefix}[${mark === ' ' ? 'x' : ' '}]`,
  )
  if (toggled === current) return source
  lines[line] = toggled
  return lines.join('\n')
}
