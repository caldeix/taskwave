import { describe, expect, it } from 'vitest'
import {
  BACKUP_APP,
  fromJsonValue,
  isBackupError,
  keyNumber,
  parseBackup,
  tasksToCsv,
  toJsonValue,
} from './backup'

const ts = (ms: number) => ({ toMillis: () => ms })

describe('marcas de tiempo en la copia (idea 10)', () => {
  it('ida y vuelta en cualquier nivel', () => {
    const doc = {
      createdAt: ts(1000),
      nested: { at: ts(2000), list: [ts(3000), 'x'] },
      title: 'Hola',
      none: null,
    }
    const json = toJsonValue(doc)
    expect(json).toEqual({
      createdAt: { $ts: 1000 },
      nested: { at: { $ts: 2000 }, list: [{ $ts: 3000 }, 'x'] },
      title: 'Hola',
      none: null,
    })
    expect(fromJsonValue(JSON.parse(JSON.stringify(json)), (ms) => `T${ms}`)).toEqual({
      createdAt: 'T1000',
      nested: { at: 'T2000', list: ['T3000', 'x'] },
      title: 'Hola',
      none: null,
    })
  })
})

describe('parseBackup', () => {
  const valid = {
    app: BACKUP_APP,
    format: 1,
    version: '1.1.0',
    exportedAt: '2026-11-09T10:00:00.000Z',
    projects: [{ id: 'p1' }],
    tags: [],
    tasks: [{ id: 't1', key: 'EST-1' }],
    worklogs: [],
    templates: [],
  }

  it('acepta una copia válida', () => {
    const parsed = parseBackup(JSON.stringify(valid))
    expect(isBackupError(parsed)).toBe(false)
  })

  it('rechaza lo que no es una copia de TaskWave', () => {
    expect(parseBackup('no es json')).toBe('notJson')
    expect(parseBackup('{"app":"Otra"}')).toBe('notTaskWave')
    expect(parseBackup(JSON.stringify({ ...valid, format: 99 }))).toBe('newerFormat')
    expect(parseBackup(JSON.stringify({ ...valid, tasks: [{ key: 'X' }] }))).toBe('malformed')
    expect(parseBackup(JSON.stringify({ ...valid, tags: undefined }))).toBe('malformed')
  })
})

describe('keyNumber', () => {
  it('saca el número de la clave', () => {
    expect(keyNumber('EST-12')).toBe(12)
    expect(keyNumber('INB-3')).toBe(3)
    expect(keyNumber('raro')).toBe(0)
  })
})

describe('tasksToCsv', () => {
  it('escribe cabecera y filas, con comillas y protegido contra fórmulas', () => {
    const csv = tasksToCsv(
      [
        {
          id: 't1',
          key: 'EST-1',
          title: 'Comprar "pan", leche',
          status: 'done',
          priority: 'high',
          projectId: 'p1',
          startDate: '2026-11-01',
          endDate: null,
          estimateMin: 60,
          spentMin: 30,
          tagIds: ['a', 'b'],
          resolvedAt: { $ts: Date.UTC(2026, 10, 2) },
        },
        { id: 't2', key: 'INB-1', title: '=SUMA(A1)', status: 'pending', priority: 'low' },
      ],
      {
        project: (id) => (id === 'p1' ? 'Estudio' : 'Sin proyecto'),
        tag: (id) => id.toUpperCase(),
      },
    )
    const lines = csv.replace('﻿', '').trim().split('\r\n')
    expect(lines[0]).toBe(
      'clave,titulo,estado,prioridad,proyecto,inicio,fin,estimado_min,horas_min,tags,cerrada',
    )
    expect(lines[1]).toBe(
      'EST-1,"Comprar ""pan"", leche",done,high,Estudio,2026-11-01,,60,30,"A, B",2026-11-02',
    )
    expect(lines[2]).toBe("INB-1,'=SUMA(A1),pending,low,Sin proyecto,,,,,,")
  })
})
