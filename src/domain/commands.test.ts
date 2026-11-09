import { describe, expect, it } from 'vitest'
import { filterCommands, type Command } from './commands'

const noop = () => {}
const commands: Command[] = [
  { id: 's-done', group: 'Estado', label: 'Realizada', run: noop },
  { id: 's-prog', group: 'Estado', label: 'En curso', run: noop },
  { id: 'p-high', group: 'Prioridad', label: 'Alta', run: noop },
  { id: 'dup', group: 'Tarea', label: 'Duplicar', keywords: 'copiar clonar', run: noop },
  { id: 'del', group: 'Tarea', label: 'Borrar', keywords: 'eliminar', run: noop },
  { id: 'off', group: 'Tarea', label: 'Parar el cronómetro', disabled: true, run: noop },
]

describe('filterCommands (idea 3)', () => {
  it('sin texto devuelve todos los activos, en su orden', () => {
    expect(filterCommands(commands, '').map((c) => c.id)).toEqual([
      's-done',
      's-prog',
      'p-high',
      'dup',
      'del',
    ])
  })

  it('busca por etiqueta, grupo y palabras extra, sin tildes ni mayúsculas', () => {
    expect(filterCommands(commands, 'realiz').map((c) => c.id)).toEqual(['s-done'])
    expect(filterCommands(commands, 'estado').map((c) => c.id)).toEqual(['s-done', 's-prog'])
    expect(filterCommands(commands, 'clonar').map((c) => c.id)).toEqual(['dup'])
    expect(filterCommands(commands, 'PRIORIDAD alta').map((c) => c.id)).toEqual(['p-high'])
  })

  it('primero los que empiezan por lo escrito', () => {
    expect(filterCommands(commands, 'e').map((c) => c.id)[0]).toBe('s-prog')
  })

  it('no propone los desactivados', () => {
    expect(filterCommands(commands, 'cronometro')).toEqual([])
  })
})
