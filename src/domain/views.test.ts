import { describe, expect, it } from 'vitest'
import { viewFromQuery, viewToQuery } from './views'

describe('vista principal en la URL', () => {
  it('traduce entre la URL y la preferencia', () => {
    expect(viewToQuery('calendar')).toBe('calendario')
    expect(viewToQuery('kanban')).toBe('kanban')
    expect(viewFromQuery('calendario', 'kanban')).toBe('calendar')
    expect(viewFromQuery('kanban', 'calendar')).toBe('kanban')
  })

  it('sin valor o con un valor raro usa la preferencia', () => {
    expect(viewFromQuery(undefined, 'kanban')).toBe('kanban')
    expect(viewFromQuery('tabla', 'calendar')).toBe('calendar')
    expect(viewFromQuery(['kanban'], 'calendar')).toBe('calendar')
  })
})
