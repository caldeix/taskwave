import { describe, expect, it } from 'vitest'
import {
  actionPatch,
  availableActions,
  countByStatus,
  filterUsers,
  needsConfirmation,
  type AdminUserRow,
} from './adminUsers'

function row(uid: string, status: AdminUserRow['status'], extra: Partial<AdminUserRow> = {}) {
  return {
    uid,
    email: `${uid}@x.com`,
    displayName: uid,
    provider: 'password',
    status,
    admin: false,
    createdAtMs: 1000,
    approvedAtMs: status === 'active' ? 2000 : null,
    ...extra,
  } satisfies AdminUserRow
}

const users = [
  row('ana', 'active', { createdAtMs: 100 }),
  row('bea', 'pending', { createdAtMs: 300 }),
  row('carlos', 'blocked', { createdAtMs: 200 }),
  row('dani', 'pending', { createdAtMs: 500, displayName: 'José Pérez' }),
  row('eva', 'pending', { createdAtMs: null }),
]

describe('filterUsers', () => {
  it('ordena pendientes primero y, dentro, los más recientes', () => {
    expect(filterUsers(users, 'all', '').map((u) => u.uid)).toEqual([
      'eva', // sin fecha todavía (recién creado): arriba
      'dani',
      'bea',
      'ana',
      'carlos',
    ])
  })

  it('filtra por estado', () => {
    expect(filterUsers(users, 'pending', '').map((u) => u.uid)).toEqual(['eva', 'dani', 'bea'])
    expect(filterUsers(users, 'blocked', '').map((u) => u.uid)).toEqual(['carlos'])
  })

  it('busca por nombre o correo sin distinguir mayúsculas ni tildes', () => {
    expect(filterUsers(users, 'all', 'jose').map((u) => u.uid)).toEqual(['dani'])
    expect(filterUsers(users, 'all', 'CARLOS@').map((u) => u.uid)).toEqual(['carlos'])
    expect(filterUsers(users, 'active', 'bea')).toEqual([])
  })
})

describe('countByStatus', () => {
  it('cuenta cada estado y el total', () => {
    expect(countByStatus(users)).toEqual({ pending: 3, active: 1, blocked: 1, all: 5 })
  })
})

describe('availableActions', () => {
  it('depende del estado y nunca sobre uno mismo', () => {
    expect(availableActions(row('a', 'pending'), 'yo')).toEqual(['approve', 'block'])
    expect(availableActions(row('a', 'active'), 'yo')).toEqual(['block'])
    expect(availableActions(row('a', 'blocked'), 'yo')).toEqual(['reactivate'])
    expect(availableActions(row('yo', 'active', { admin: true }), 'yo')).toEqual([])
  })

  it('bloquear pide confirmación; aprobar y reactivar no', () => {
    expect(needsConfirmation('block')).toBe(true)
    expect(needsConfirmation('approve')).toBe(false)
    expect(needsConfirmation('reactivate')).toBe(false)
  })
})

describe('actionPatch', () => {
  const now = { servidor: true }

  it('aprobar guarda quién y cuándo', () => {
    expect(actionPatch('approve', row('a', 'pending'), 'adm', now)).toEqual({
      status: 'active',
      approvedAt: now,
      approvedBy: 'adm',
    })
  })

  it('bloquear solo cambia el estado', () => {
    expect(actionPatch('block', row('a', 'active'), 'adm', now)).toEqual({ status: 'blocked' })
  })

  it('reactivar conserva la aprobación original si la había', () => {
    expect(actionPatch('reactivate', row('a', 'blocked', { approvedAtMs: 5 }), 'adm', now)).toEqual(
      {
        status: 'active',
      },
    )
    expect(actionPatch('reactivate', row('a', 'blocked'), 'adm', now)).toEqual({
      status: 'active',
      approvedAt: now,
      approvedBy: 'adm',
    })
  })
})
