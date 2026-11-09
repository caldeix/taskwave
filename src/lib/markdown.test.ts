import { describe, expect, it } from 'vitest'
import { renderMarkdown, taskUrl, toggleChecklistLine } from './markdown'

describe('renderMarkdown', () => {
  it('formatea markdown habitual', () => {
    const html = renderMarkdown('## Título\n\n**negrita** y _cursiva_\n\n- uno\n- dos\n\n`código`')
    expect(html).toContain('<h2>Título</h2>')
    expect(html).toContain('<strong>negrita</strong>')
    expect(html).toContain('<em>cursiva</em>')
    expect(html).toContain('<li>uno</li>')
    expect(html).toContain('<code>código</code>')
  })

  it('los enlaces se abren en otra pestaña sin pasar el origen', () => {
    const html = renderMarkdown('[Vue](https://vuejs.org) y https://example.com')
    expect(html).toContain('href="https://vuejs.org"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer nofollow"')
    expect(html).toContain('href="https://example.com"') // linkify
  })

  it('convierte las checklists en casillas con la línea de origen', () => {
    const html = renderMarkdown('Lista:\n\n- [x] hecho\n- [ ] pendiente')
    expect(html).toMatch(/<input[^>]*type="checkbox"[^>]*data-line="2"[^>]*checked/)
    expect(html).toMatch(/<input[^>]*data-line="3"/)
    expect(html).not.toMatch(/data-line="3"[^>]*checked/)
    expect(html).toContain('hecho')
    expect(html).not.toContain('[x]')
  })
})

describe('renderMarkdown frente a XSS (CA-10)', () => {
  const attacks = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<a href="javascript:alert(1)">pincha</a>',
    '[pincha](javascript:alert(1))',
    '[pincha](JaVaScRiPt:alert(1))',
    '[pincha](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
    '![img](javascript:alert(1))',
    '<iframe src="https://malo.com"></iframe>',
    '<svg onload=alert(1)>',
    '<div style="background:url(javascript:alert(1))">x</div>',
    '[x](vbscript:msgbox(1))',
  ]

  /** Analiza el HTML como lo haría el navegador y busca lo que podría ejecutar código. */
  function dangers(html: string): string[] {
    const box = document.createElement('div')
    box.innerHTML = html
    const found: string[] = []
    box
      .querySelectorAll('script, iframe, svg, object, embed, style, div, form')
      .forEach((el) => found.push(`<${el.tagName.toLowerCase()}>`))
    box.querySelectorAll('*').forEach((el) => {
      for (const attr of [...el.attributes]) {
        if (attr.name.startsWith('on') || attr.name === 'style') found.push(attr.name)
        if (['href', 'src'].includes(attr.name) && !/^(https?:|mailto:)/i.test(attr.value))
          found.push(`${attr.name}=${attr.value}`)
      }
    })
    return found
  }

  it.each(attacks)('no deja código ejecutable: %s', (attack) => {
    expect(dangers(renderMarkdown(attack))).toEqual([])
  })

  it('el HTML escrito se ve como texto', () => {
    expect(renderMarkdown('<b>hola</b>')).toContain('&lt;b&gt;hola&lt;/b&gt;')
  })
})

describe('toggleChecklistLine', () => {
  const source = 'Texto\n\n- [ ] uno\n- [x] dos\n  * [X] anidada\n1. [ ] numerada\n- sin casilla'

  it('marca y desmarca la casilla de esa línea', () => {
    expect(toggleChecklistLine(source, 2).split('\n')[2]).toBe('- [x] uno')
    expect(toggleChecklistLine(source, 3).split('\n')[3]).toBe('- [ ] dos')
    expect(toggleChecklistLine(source, 4).split('\n')[4]).toBe('  * [ ] anidada')
    expect(toggleChecklistLine(source, 5).split('\n')[5]).toBe('1. [x] numerada')
  })

  it('no toca nada si la línea no tiene casilla o no existe', () => {
    expect(toggleChecklistLine(source, 0)).toBe(source)
    expect(toggleChecklistLine(source, 6)).toBe(source)
    expect(toggleChecklistLine(source, 99)).toBe(source)
  })

  it('cambiar dos veces deja el texto como estaba', () => {
    expect(toggleChecklistLine(toggleChecklistLine(source, 2), 2)).toBe(source)
  })
})

describe('claves de tarea enlazadas (v1.1.0)', () => {
  it('enlaza las claves del texto a la tarea, sin abrir otra pestaña', () => {
    const html = renderMarkdown('Depende de EST-12 y de INB-3.')
    expect(html).toContain(`href="${taskUrl('EST-12')}"`)
    expect(html).toContain('data-task-key="EST-12"')
    expect(html).toContain('data-task-key="INB-3"')
    expect(html).toContain('class="md-task-key"')
    expect(html).not.toMatch(/data-task-key="EST-12"[^>]*target=/)
    expect(html).toContain('Depende de <a')
  })

  it('no toca el código, los enlaces ni lo que no es una clave', () => {
    const html = renderMarkdown('`EST-12` [ver EST-13](https://x.com) est-14 E-15 ABCDEFG-1')
    expect(html).not.toContain('data-task-key="EST-12"')
    expect(html).not.toContain('data-task-key="EST-13"')
    expect(html).not.toContain('data-task-key')
  })

  it('una clave en una lista de casillas también se enlaza', () => {
    const html = renderMarkdown('- [ ] revisar EST-7')
    expect(html).toContain('data-task-key="EST-7"')
    expect(html).toContain('class="md-task"')
  })
})
