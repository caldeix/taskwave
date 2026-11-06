import { describe, expect, it } from 'vitest'
import { startedProgress, startedTasks } from './started'
import { taskFromData, type Task } from './task'

const ts = (ms: number) => ({ toMillis: () => ms })
function task(key: string, extra: Record<string, unknown> = {}): Task {
  return taskFromData(key, { key, status: 'in_progress', spentMin: 30, ...extra })
}

describe('startedTasks (D-33, CA-14)', () => {
  it('abiertas con horas, de la última trabajada a la más antigua', () => {
    const list = startedTasks([
      task('EST-1', { lastWorkedAt: ts(1000) }),
      task('EST-2', { lastWorkedAt: ts(3000), status: 'paused' }),
      task('EST-3', { lastWorkedAt: ts(2000), status: 'pending' }),
    ])
    expect(list.map((t) => t.key)).toEqual(['EST-2', 'EST-3', 'EST-1'])
  })

  it('quita las cerradas y las que se quedaron sin horas', () => {
    const list = startedTasks([
      task('EST-1', { lastWorkedAt: ts(1000), status: 'done' }),
      task('EST-2', { lastWorkedAt: ts(2000), spentMin: 0 }),
      task('EST-3', { lastWorkedAt: ts(500) }),
    ])
    expect(list.map((t) => t.key)).toEqual(['EST-3'])
  })

  it('a igual fecha, por clave', () => {
    const list = startedTasks([task('EST-10'), task('EST-9')])
    expect(list.map((t) => t.key)).toEqual(['EST-9', 'EST-10'])
  })
})

describe('startedProgress', () => {
  it('% sobre el estimado, con la barra limitada al 100 % y el exceso marcado', () => {
    expect(startedProgress({ spentMin: 90, estimateMin: 200 })).toEqual({
      label: '45 %',
      width: 45,
      over: false,
    })
    expect(startedProgress({ spentMin: 300, estimateMin: 200 })).toEqual({
      label: '150 %',
      width: 100,
      over: true,
    })
  })

  it('sin estimado muestra las horas', () => {
    expect(startedProgress({ spentMin: 210, estimateMin: null })).toEqual({
      label: '3h 30m',
      width: 0,
      over: false,
    })
  })
})
