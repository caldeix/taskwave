import { describe, expect, it } from 'vitest'
import { viewFromQuery, viewToQuery } from './views'

describe('vista principal en la URL', () => {
  it('traduce entre la URL y la preferencia', () => {
    expect(viewToQuery('calendar')).toBe('calendario')
    expect(viewToQuery('kanban')).toBe('kanban')
    expect(viewFromQuery('calendario', 'kanban')).toBe('calendar')
    expect(viewFromQuery('kanban', 'calendar')).toBe('kanban')
    expect(viewToQuery('list')).toBe('lista')
    expect(viewFromQuery('lista', 'calendar')).toBe('list')
    expect(viewFromQuery('backlog', 'calendar')).toBe('backlog')
  })

  it('sin valor o con un valor raro usa la preferencia', () => {
    expect(viewFromQuery(undefined, 'kanban')).toBe('kanban')
    expect(viewFromQuery('tabla', 'calendar')).toBe('calendar')
    expect(viewFromQuery(['kanban'], 'calendar')).toBe('calendar')
  })
})
