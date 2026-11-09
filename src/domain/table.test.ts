import { describe, expect, it } from 'vitest'
import { nextSort, sortTable, withTag, withoutTag } from './table'
import { taskFromData, type Task } from './task'

function task(id: string, extra: Record<string, unknown> = {}): Task {
  return taskFromData(id, { key: id, title: id, ...extra })
}

describe('sortTable (idea 5)', () => {
  const tasks = [
    task('EST-10', { title: 'Beta', endDate: '2026-11-20', priority: 'low', estimateMin: 60 }),
    task('EST-2', { title: 'alfa', endDate: null, priority: 'high', estimateMin: null }),
    task('EST-3', { title: 'Gamma', endDate: '2026-11-10', priority: 'medium', estimateMin: 30 }),
  ]
  const keys = (list: Task[]) => list.map((t) => t.key)

  it('ordena las claves por número, no como texto', () => {
    expect(keys(sortTable(tasks, 'key', 'asc'))).toEqual(['EST-2', 'EST-3', 'EST-10'])
  })

  it('títulos sin distinguir mayúsculas', () => {
    expect(keys(sortTable(tasks, 'title', 'asc'))).toEqual(['EST-2', 'EST-10', 'EST-3'])
  })

  it('los vacíos van al final en los dos sentidos', () => {
    expect(keys(sortTable(tasks, 'endDate', 'asc'))).toEqual(['EST-3', 'EST-10', 'EST-2'])
    expect(keys(sortTable(tasks, 'endDate', 'desc'))).toEqual(['EST-10', 'EST-3', 'EST-2'])
    expect(keys(sortTable(tasks, 'estimate', 'desc'))).toEqual(['EST-10', 'EST-3', 'EST-2'])
  })

  it('la prioridad sigue su orden (alta, media, baja)', () => {
    expect(keys(sortTable(tasks, 'priority', 'asc'))).toEqual(['EST-2', 'EST-3', 'EST-10'])
  })

  it('por proyecto, con el nombre que se le pasa', () => {
    const name = (t: Task) => (t.key === 'EST-3' ? 'Casa' : 'Trabajo')
    expect(keys(sortTable(tasks, 'project', 'asc', name))[0]).toBe('EST-3')
  })
})

describe('nextSort', () => {
  it('otra columna empieza ascendente; la misma alterna', () => {
    expect(nextSort({ column: 'key', dir: 'asc' }, 'title')).toEqual({
      column: 'title',
      dir: 'asc',
    })
    expect(nextSort({ column: 'key', dir: 'asc' }, 'key')).toEqual({ column: 'key', dir: 'desc' })
    expect(nextSort({ column: 'key', dir: 'desc' }, 'key')).toEqual({ column: 'key', dir: 'asc' })
  })
})

describe('tags en bloque (idea 6)', () => {
  it('añade sin repetir ni pasar de 20', () => {
    expect(withTag(['a'], 'b')).toEqual(['a', 'b'])
    expect(withTag(['a'], 'a')).toBeNull()
    expect(
      withTag(
        Array.from({ length: 20 }, (_, i) => `t${i}`),
        'x',
      ),
    ).toBeNull()
  })

  it('quita solo si lo tenía', () => {
    expect(withoutTag(['a', 'b'], 'a')).toEqual(['b'])
    expect(withoutTag(['a'], 'z')).toBeNull()
  })
})
