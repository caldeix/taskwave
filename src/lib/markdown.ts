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

/**
 * Claves de tarea enlazadas solas (v1.1.0, D-3): `EST-12` en el texto pasa a ser un enlace a la
 * tarea con `data-task-key`, para pintar su estado. No se toca el código ni el texto que ya está
 * dentro de un enlace.
 */
export const TASK_KEY_IN_TEXT = /(?<![A-Za-z0-9-])([A-Z][A-Z0-9]{1,5}-[0-9]{1,7})(?![A-Za-z0-9-])/g

/** URL absoluta de una tarea (DOMPurify solo deja enlaces `http(s)`). */
export function taskUrl(key: string): string {
  const origin = typeof location === 'undefined' ? 'http://localhost' : location.origin
  return `${origin}${import.meta.env.BASE_URL}t/${key}`
}

md.core.ruler.push('task-keys', (state) => {
  type InlineToken = NonNullable<(typeof state.tokens)[number]['children']>[number]
  const text = (content: string): InlineToken => {
    const token = new state.Token('text', '', 0)
    token.content = content
    return token
  }
  for (const block of state.tokens) {
    if (block.type !== 'inline' || !block.children) continue
    const out: InlineToken[] = []
    let insideLink = 0
    for (const token of block.children) {
      if (token.type === 'link_open') insideLink += 1
      if (token.type === 'link_close') insideLink -= 1
      TASK_KEY_IN_TEXT.lastIndex = 0
      if (token.type !== 'text' || insideLink > 0 || !TASK_KEY_IN_TEXT.test(token.content)) {
        out.push(token)
        continue
      }
      // `matchAll` copia `lastIndex`, que `test` acaba de mover.
      TASK_KEY_IN_TEXT.lastIndex = 0
      let last = 0
      for (const match of token.content.matchAll(TASK_KEY_IN_TEXT)) {
        const key = match[1]!
        const at = match.index ?? 0
        if (at > last) out.push(text(token.content.slice(last, at)))
        const open = new state.Token('link_open', 'a', 1)
        open.attrSet('href', taskUrl(key))
        open.attrSet('class', 'md-task-key')
        open.attrSet('data-task-key', key)
        out.push(open, text(key), new state.Token('link_close', 'a', -1))
        last = at + key.length
      }
      if (last < token.content.length) out.push(text(token.content.slice(last)))
    }
    block.children = out
  }
})

// Enlaces externos en otra pestaña y sin pasar el origen. Las claves de tarea abren en la app.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName !== 'A') return
  if (node.getAttribute('data-task-key')) {
    node.removeAttribute('target')
    return
  }
  node.setAttribute('target', '_blank')
  node.setAttribute('rel', 'noopener noreferrer nofollow')
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
    'data-task-key',
    'start',
    'align',
  ],
  ALLOW_DATA_ATTR: false,
  // Solo http(s) y mailto en enlaces e imágenes (D-44: sin subidas).
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
  // DOMPurify aplica esa regla a todos los atributos salvo a los «seguros»: sin esto quitaría
  // `type="checkbox"` y `data-line` de las casillas.
  ADD_URI_SAFE_ATTR: ['type', 'data-line', 'data-task-key', 'start', 'align'],
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
