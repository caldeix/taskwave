import { describe, expect, it } from 'vitest'
import {
  normalizeDate,
  normalizeEstimate,
  normalizeKey,
  normalizeLinkKind,
  normalizePriority,
  normalizeRecurrence,
  normalizeStatus,
  resolveProject,
  resolveTags,
  summarize,
} from './normalize'
import type { Project } from '@/domain/projects'
import type { Tag } from '@/domain/tags'
import { taskFromData } from '@/domain/task'

const projects = [
  { id: 'p1', key: 'EST', name: 'Estudio' },
  { id: 'p2', key: 'CASA', name: 'Casa' },
] as Project[]
const tags = [
  { id: 't1', name: 'urgente', color: 'coral' },
  { id: 't2', name: 'trámites', color: 'blue' },
] as Tag[]

describe('estados, prioridades y vínculos en español o inglés (v1.3.0)', () => {
  it('estados', () => {
    expect(normalizeStatus('En curso')).toBe('in_progress')
    expect(normalizeStatus('in_progress')).toBe('in_progress')
    expect(normalizeStatus('REALIZADA')).toBe('done')
    expect(normalizeStatus('hecha')).toBe('done')
    expect(normalizeStatus('paralizada')).toBe('paused')
    expect(() => normalizeStatus('volando')).toThrow(/Estado desconocido/)
  })

  it('prioridades', () => {
    expect(normalizePriority('alta')).toBe('high')
    expect(normalizePriority('low')).toBe('low')
    expect(() => normalizePriority('máxima')).toThrow(/Prioridad desconocida/)
  })

  it('tipos de vínculo', () => {
    expect(normalizeLinkKind('bloquea a')).toBe('blocks')
    expect(normalizeLinkKind('blocked_by')).toBe('blocked_by')
    expect(normalizeLinkKind('es subtarea de')).toBe('parent')
    expect(normalizeLinkKind('subtarea')).toBe('child')
    expect(() => normalizeLinkKind('primo de')).toThrow(/Tipo de vínculo/)
  })
})

describe('recurrencia, fechas y duraciones', () => {
  it('recurrencia por nombre u objeto; null la quita', () => {
    expect(normalizeRecurrence('semanal')).toEqual({ freq: 'week', interval: 1 })
    expect(normalizeRecurrence('2weeks')).toEqual({ freq: 'week', interval: 2 })
    expect(normalizeRecurrence('Cada mes')).toEqual({ freq: 'month', interval: 1 })
    expect(normalizeRecurrence({ freq: 'day', interval: 3 })).toEqual({ freq: 'day', interval: 3 })
    expect(normalizeRecurrence(null)).toBeNull()
    expect(normalizeRecurrence('none')).toBeNull()
    expect(() => normalizeRecurrence('cada hora')).toThrow(/Recurrencia desconocida/)
    expect(() => normalizeRecurrence({ freq: 'day', interval: 0 })).toThrow(/no válida/)
  })

  it('fechas relativas e ISO', () => {
    expect(normalizeDate('hoy', '2026-11-10')).toBe('2026-11-10')
    expect(normalizeDate('mañana', '2026-11-10')).toBe('2026-11-11')
    expect(normalizeDate('Pasado mañana', '2026-11-30')).toBe('2026-12-02')
    expect(normalizeDate('ayer', '2026-11-10')).toBe('2026-11-09')
    expect(normalizeDate('2026-12-24', '2026-11-10')).toBe('2026-12-24')
    expect(normalizeDate(null, '2026-11-10')).toBeNull()
    expect(() => normalizeDate('24/12/2026', '2026-11-10')).toThrow(/Fecha no válida/)
  })

  it('duraciones en texto o minutos', () => {
    expect(normalizeEstimate('1h 30m', 8)).toBe(90)
    expect(normalizeEstimate('1d', 8)).toBe(480)
    expect(normalizeEstimate(45, 8)).toBe(45)
    expect(normalizeEstimate('', 8)).toBeNull()
    expect(() => normalizeEstimate('mucho', 8)).toThrow(/Duración no válida/)
  })

  it('claves', () => {
    expect(normalizeKey(' est-12 ')).toBe('EST-12')
    expect(() => normalizeKey('tarea 12')).toThrow(/Clave de tarea/)
  })
})

describe('proyectos y tags por nombre', () => {
  it('proyecto por clave o nombre, sin tildes ni mayúsculas; la bandeja es null', () => {
    expect(resolveProject('est', projects)).toBe('p1')
    expect(resolveProject('Casa', projects)).toBe('p2')
    expect(resolveProject('sin proyecto', projects)).toBeNull()
    expect(resolveProject(null, projects)).toBeNull()
    expect(resolveProject(undefined, projects)).toBeUndefined()
    expect(() => resolveProject('Trabajo', projects)).toThrow(/Estudio \(EST\), Casa \(CASA\)/)
  })

  it('tags existentes por nombre y los que faltan aparte, sin repetir', () => {
    expect(resolveTags(['Urgente', 'tramites', 'nuevo', 'Nuevo'], tags)).toEqual({
      ids: ['t1', 't2'],
      missing: ['nuevo'],
    })
    expect(resolveTags('urgente', tags)).toEqual({ ids: ['t1'], missing: [] })
  })
})

describe('summarize', () => {
  it('resume la tarea con nombres legibles y su enlace', () => {
    const task = taskFromData('a', {
      key: 'EST-1',
      title: 'Estudiar',
      projectId: 'p1',
      estimateMin: 90,
      spentMin: 30,
      tagIds: ['t1', 'borrado'],
      parentId: 'b',
      recurrence: { freq: 'week', interval: 1 },
    })
    const summary = summarize(task, {
      projectName: (id) => projects.find((p) => p.id === id)?.name ?? null,
      tagName: (id) => tags.find((t) => t.id === id)?.name,
      keyOf: (id) => (id === 'b' ? 'EST-0' : undefined),
      hoursPerDay: 8,
      baseUrl: 'https://caldeix.github.io/taskwave/',
    })
    expect(summary).toMatchObject({
      key: 'EST-1',
      project: 'Estudio',
      estimate: '1h 30m',
      spent: '30m',
      tags: ['urgente'],
      parent: 'EST-0',
      recurrence: 'semanal',
      url: 'https://caldeix.github.io/taskwave/t/EST-1',
    })
  })
})
