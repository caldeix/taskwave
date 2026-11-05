import type { UserStatus } from './profile'

/**
 * Lógica pura del panel de administración de usuarios (step-7).
 * Las reglas de Firestore son las que de verdad limitan lo que puede hacer el admin.
 */

export interface AdminUserRow {
  uid: string
  email: string
  displayName: string
  provider: string
  status: UserStatus
  admin: boolean
  /** Milisegundos, o `null` si el servidor aún no ha puesto la fecha. */
  createdAtMs: number | null
  approvedAtMs: number | null
}

export type UserFilter = 'pending' | 'active' | 'blocked' | 'all'

export type UserAction = 'approve' | 'block' | 'reactivate'

/** Pendientes primero; dentro de cada estado, los más recientes arriba. */
const STATUS_ORDER: Record<UserStatus, number> = { pending: 0, active: 1, blocked: 2 }

export function sortUsers(users: AdminUserRow[]): AdminUserRow[] {
  return [...users].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      (b.createdAtMs ?? Infinity) - (a.createdAtMs ?? Infinity),
  )
}

/** Quita tildes y pasa a minúsculas para buscar sin distinguir «José» de «jose». */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

export function filterUsers(
  users: AdminUserRow[],
  filter: UserFilter,
  search: string,
): AdminUserRow[] {
  const needle = normalize(search.trim())
  return sortUsers(
    users.filter(
      (u) =>
        (filter === 'all' || u.status === filter) &&
        (!needle || normalize(`${u.displayName} ${u.email}`).includes(needle)),
    ),
  )
}

export function countByStatus(users: AdminUserRow[]): Record<UserFilter, number> {
  const counts: Record<UserFilter, number> = {
    pending: 0,
    active: 0,
    blocked: 0,
    all: users.length,
  }
  for (const u of users) counts[u.status]++
  return counts
}

/** Acciones posibles sobre un usuario. El admin nunca actúa sobre sí mismo. */
export function availableActions(user: AdminUserRow, myUid: string): UserAction[] {
  if (user.uid === myUid) return []
  if (user.status === 'pending') return ['approve', 'block']
  if (user.status === 'active') return ['block']
  return ['reactivate']
}

/** Acciones que piden confirmación antes de aplicarse. */
export function needsConfirmation(action: UserAction): boolean {
  return action === 'block'
}

/**
 * Cambios a escribir en `users/{uid}` para una acción. Solo toca `status`, `approvedAt`
 * y `approvedBy`, que es lo único que las reglas dejan cambiar al admin.
 * `serverNow` es el `serverTimestamp()` de Firestore.
 */
export function actionPatch(
  action: UserAction,
  user: AdminUserRow,
  adminUid: string,
  serverNow: unknown,
): Record<string, unknown> {
  if (action === 'block') return { status: 'blocked' }
  // Aprobar, o reactivar a alguien que nunca se aprobó (se bloqueó estando pendiente).
  if (action === 'approve' || user.approvedAtMs === null) {
    return { status: 'active', approvedAt: serverNow, approvedBy: adminUid }
  }
  return { status: 'active' }
}
