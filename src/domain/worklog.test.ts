import { describe, expect, it } from 'vitest'
import {
  adjustSpent,
  groupByDay,
  parseEntry,
  timeOf,
  worklogFromData,
  type EntryInput,
  type Worklog,
} from './worklog'

const TODAY = '2026-11-06'
const base: EntryInput = { date: '2026-11-05', duration: '1h 30m', startTime: '09:15', note: '' }

describe('parseEntry (D-29, D-30)', () => {
  it('calcula los minutos y las horas de inicio y fin en hora local', () => {
    const { errors, entry } = parseEntry({ ...base, note: '  repaso  ' }, TODAY)
    expect(errors).toEqual({})
    expect(entry).toEqual({
      date: '2026-11-05',
      minutes: 90,
      startMs: new Date(2026, 10, 5, 9, 15).getTime(),
      endMs: new Date(2026, 10, 5, 10, 45).getTime(),
      note: 'repaso',
    })
  })

  it('entiende el formato de Jira con la jornada configurada (1d = 8 h o la que sea)', () => {
    expect(parseEntry({ ...base, duration: '1d' }, TODAY).entry?.minutes).toBe(480)
    expect(parseEntry({ ...base, duration: '1d' }, TODAY, 6).entry?.minutes).toBe(360)
    expect(parseEntry({ ...base, duration: '2' }, TODAY).entry?.minutes).toBe(120)
  })

  it('rechaza fechas futuras o mal escritas', () => {
    expect(parseEntry({ ...base, date: '2026-11-07' }, TODAY).errors.date).toBe(
      'worklog.errors.future',
    )
    expect(parseEntry({ ...base, date: '2026-13-01' }, TODAY).errors.date).toBe(
      'worklog.errors.date',
    )
    expect(parseEntry({ ...base, date: TODAY }, TODAY).errors).toEqual({})
  })

  it('la duración va de 1 minuto a 24 h', () => {
    expect(parseEntry({ ...base, duration: 'mucho' }, TODAY).errors.duration).toBe(
      'worklog.errors.duration',
    )
    expect(parseEntry({ ...base, duration: '0m' }, TODAY).errors.duration).toBe(
      'worklog.errors.zero',
    )
    expect(parseEntry({ ...base, duration: '3d 1m' }, TODAY).errors.duration).toBe(
      'worklog.errors.tooLong',
    )
    expect(parseEntry({ ...base, duration: '24h' }, TODAY).entry?.minutes).toBe(1440)
  })

  it('valida la hora de inicio y la nota', () => {
    expect(parseEntry({ ...base, startTime: '25:00' }, TODAY).errors.startTime).toBe(
      'worklog.errors.startTime',
    )
    expect(parseEntry({ ...base, startTime: '9:00' }, TODAY).errors.startTime).toBe(
      'worklog.errors.startTime',
    )
    expect(parseEntry({ ...base, note: 'x'.repeat(501) }, TODAY).errors.note).toBe(
      'worklog.errors.note',
    )
    expect(parseEntry({ ...base, note: 'x'.repeat(501) }, TODAY).entry).toBeNull()
  })
})

const log = (id: string, date: string, minutes: number, startedAtMs: number): Worklog => ({
  id,
  taskId: 't',
  projectId: null,
  date,
  minutes,
  startedAtMs,
  endedAtMs: startedAtMs + minutes * 60_000,
  source: 'manual',
  note: '',
})

describe('groupByDay', () => {
  it('agrupa por día, del más reciente al más antiguo, con el total de cada día', () => {
    const days = groupByDay([
      log('a', '2026-11-04', 30, 1000),
      log('b', '2026-11-05', 60, 2000),
      log('c', '2026-11-05', 45, 5000),
    ])
    expect(days.map((d) => [d.date, d.totalMin, d.logs.map((l) => l.id)])).toEqual([
      ['2026-11-05', 105, ['c', 'b']],
      ['2026-11-04', 30, ['a']],
    ])
    expect(groupByDay([])).toEqual([])
  })
})

describe('adjustSpent, timeOf y worklogFromData', () => {
  it('ajusta el total de la tarea sin bajar de cero', () => {
    expect(adjustSpent(100, 0, 30)).toBe(130) // alta
    expect(adjustSpent(100, 30, 45)).toBe(115) // edición
    expect(adjustSpent(100, 30, 0)).toBe(70) // borrado
    expect(adjustSpent(10, 30, 0)).toBe(0)
  })

  it('formatea la hora local y lee los datos de Firestore', () => {
    expect(timeOf(new Date(2026, 10, 5, 7, 5).getTime())).toBe('07:05')
    expect(timeOf(null)).toBe('')
    expect(
      worklogFromData('w', { taskId: 't', date: '2026-11-05', minutes: 30, source: 'timer' }),
    ).toMatchObject({ id: 'w', minutes: 30, source: 'timer', projectId: null, startedAtMs: null })
  })
})
