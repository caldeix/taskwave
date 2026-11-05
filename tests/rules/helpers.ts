import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { Timestamp, doc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore'

/** Proyecto propio de los tests: no se mezcla con `demo-taskwave` (datos del seed). */
export const PROJECT_ID = 'demo-taskwave-rules'

export function setupEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
}

export const U = {
  admin: 'u-admin',
  active: 'u-active',
  other: 'u-other',
  pending: 'u-pending',
  blocked: 'u-blocked',
  newcomer: 'u-new',
} as const

export const emailOf = (uid: string) => `${uid}@taskwave.test`

/** Firestore con la sesión de `uid` (correo verificado salvo que se diga lo contrario). */
export function as(env: RulesTestEnvironment, uid: string, emailVerified = true): Firestore {
  return env
    .authenticatedContext(uid, { email: emailOf(uid), email_verified: emailVerified })
    .firestore() as unknown as Firestore
}

export function anon(env: RulesTestEnvironment): Firestore {
  return env.unauthenticatedContext().firestore() as unknown as Firestore
}

export const DEFAULT_PREFS = {
  theme: 'system',
  view: 'calendar',
  sidebarCollapsed: false,
  hoursPerDay: 8,
  timerWarnHours: 8,
  filters: null,
}

/** Perfil completo tal como lo guarda la app (para sembrar con las reglas desactivadas). */
export function storedProfile(uid: string, status: string, admin = false) {
  return {
    email: emailOf(uid),
    displayName: uid,
    photoURL: null,
    provider: 'password',
    status,
    admin,
    createdAt: Timestamp.fromDate(new Date('2026-01-01')),
    approvedAt: null,
    approvedBy: null,
    inboxCounter: 0,
    prefs: DEFAULT_PREFS,
    activeTimer: null,
  }
}

/** Perfil inicial que crea la app en el primer acceso. */
export function newProfile(uid: string) {
  return { ...storedProfile(uid, 'pending'), createdAt: serverTimestamp() }
}

/** Vacía el emulador y siembra los perfiles base (admin, activo, otro, pendiente y bloqueado). */
export async function resetAndSeed(env: RulesTestEnvironment): Promise<void> {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore
    await setDoc(doc(db, 'users', U.admin), storedProfile(U.admin, 'active', true))
    await setDoc(doc(db, 'users', U.active), storedProfile(U.active, 'active'))
    await setDoc(doc(db, 'users', U.other), storedProfile(U.other, 'active'))
    await setDoc(doc(db, 'users', U.pending), storedProfile(U.pending, 'pending'))
    await setDoc(doc(db, 'users', U.blocked), storedProfile(U.blocked, 'blocked'))
  })
}

// ---------------------------------------------------------------- documentos válidos

export function validProject() {
  return {
    name: 'Estudio',
    key: 'EST',
    color: 'blue',
    icon: 'book-open',
    order: 0,
    archived: false,
    taskCounter: 0,
    createdAt: serverTimestamp(),
  }
}

export function validTask() {
  return {
    key: 'EST-1',
    projectId: 'p1',
    title: 'Estudiar el tema 1',
    description: '## Objetivo\n\n- [ ] leer',
    status: 'pending',
    priority: 'medium',
    startDate: '2026-11-05',
    endDate: '2026-11-07',
    estimateMin: 120,
    spentMin: 0,
    lastWorkedAt: null,
    tagIds: [],
    links: [],
    parentId: null,
    weblinks: [],
    resolvedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
}

export function validWorklog() {
  return {
    taskId: 't1',
    projectId: 'p1',
    date: '2026-11-05',
    minutes: 60,
    startedAt: Timestamp.fromDate(new Date('2026-11-05T09:00:00')),
    endedAt: Timestamp.fromDate(new Date('2026-11-05T10:00:00')),
    source: 'timer',
    note: '',
  }
}

export function validComment() {
  return { body: 'Comentario en **markdown**', createdAt: serverTimestamp(), editedAt: null }
}

export function validActivity() {
  return { field: 'status', from: 'pending', to: 'in_progress', at: serverTimestamp() }
}

export function validTag() {
  return { name: 'universidad', color: 'violet' }
}
