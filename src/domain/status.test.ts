import { describe, expect, it } from 'vitest'
import { STATUS_STYLES, TASK_STATUSES, isClosedStatus } from './status'

describe('estados de tarea', () => {
  it('tiene los 6 estados con estilo definido', () => {
    expect(TASK_STATUSES).toHaveLength(6)
    for (const status of TASK_STATUSES) expect(STATUS_STYLES[status]).toBeDefined()
  })

  it('Realizada, Descartada y KO son estados cerrados', () => {
    expect(TASK_STATUSES.filter(isClosedStatus)).toEqual(['done', 'discarded', 'ko'])
  })
})
