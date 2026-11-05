import { describe, expect, it } from 'vitest'
import {
  moveProject,
  nextOrder,
  sortProjects,
  suggestKey,
  validateProject,
  type Project,
} from './projects'

function project(id: string, order: number, extra: Partial<Project> = {}): Project {
  return {
    id,
    name: id,
    key: id.toUpperCase(),
    color: 'blue',
    icon: 'folder',
    order,
    archived: false,
    taskCounter: 0,
    ...extra,
  }
}

describe('suggestKey', () => {
  it('usa las tres primeras letras o las iniciales, sin tildes', () => {
    expect(suggestKey('Estudio', [])).toBe('EST')
    expect(suggestKey('Música', [])).toBe('MUS')
    expect(suggestKey('Casa de la playa', [])).toBe('CDLP')
  })

  it('evita claves ocupadas y la de la bandeja', () => {
    expect(suggestKey('Estudio', ['EST'])).toBe('EST2')
    expect(suggestKey('Estudio', ['EST', 'EST2'])).toBe('EST3')
    expect(suggestKey('Inbox', [])).toBe('INB2')
  })

  it('siempre devuelve una clave válida aunque el nombre no ayude', () => {
    expect(suggestKey('', [])).toMatch(/^[A-Z][A-Z0-9]{1,5}$/)
    expect(suggestKey('2026', [])).toMatch(/^[A-Z][A-Z0-9]{1,5}$/)
    expect(suggestKey('¡¡!!', [])).toMatch(/^[A-Z][A-Z0-9]{1,5}$/)
  })
})

describe('validateProject', () => {
  const ok = { name: 'Estudio', key: 'EST', color: 'blue', icon: 'book-open' }

  it('acepta un proyecto correcto', () => {
    expect(validateProject(ok, [])).toEqual({})
  })

  it('marca cada error', () => {
    expect(validateProject({ name: ' ', key: 'est', color: 'rosa', icon: 'nope' }, [])).toEqual({
      name: 'projects.validation.nameRequired',
      key: 'projects.validation.keyFormat',
      color: 'projects.validation.color',
      icon: 'projects.validation.icon',
    })
    expect(validateProject({ ...ok, name: 'x'.repeat(61) }, []).name).toBe(
      'projects.validation.nameTooLong',
    )
  })

  it('la clave no puede repetirse ni ser la de la bandeja', () => {
    expect(validateProject(ok, ['EST']).key).toBe('projects.validation.keyTaken')
    expect(validateProject({ ...ok, key: 'INB' }, []).key).toBe('projects.validation.keyTaken')
  })
})

describe('orden de proyectos', () => {
  const list = [
    project('c', 2),
    project('a', 0),
    project('b', 1),
    project('z', 3, { archived: true }),
  ]

  it('ordena por posición', () => {
    expect(sortProjects(list).map((p) => p.id)).toEqual(['a', 'b', 'c', 'z'])
  })

  it('mover arriba o abajo intercambia posiciones entre los activos', () => {
    expect(moveProject(list, 'b', 'up')).toEqual([
      { id: 'b', order: 0 },
      { id: 'a', order: 1 },
    ])
    expect(moveProject(list, 'b', 'down')).toEqual([
      { id: 'c', order: 1 },
      { id: 'b', order: 2 },
    ])
  })

  it('no mueve más allá de los extremos', () => {
    expect(moveProject(list, 'a', 'up')).toEqual([])
    expect(moveProject(list, 'c', 'down')).toEqual([])
    expect(moveProject(list, 'z', 'up')).toEqual([])
  })

  it('arregla empates de posición al mover', () => {
    const tied = [project('a', 0), project('b', 0), project('c', 0)]
    const changes = moveProject(tied, 'c', 'up')
    const orders = Object.fromEntries(tied.map((p) => [p.id, p.order]))
    for (const c of changes) orders[c.id] = c.order
    expect(
      sortProjects(tied.map((p) => ({ ...p, order: orders[p.id]! }))).map((p) => p.id),
    ).toEqual(['a', 'c', 'b'])
  })

  it('la siguiente posición va al final', () => {
    expect(nextOrder(list)).toBe(4)
    expect(nextOrder([])).toBe(0)
  })
})
