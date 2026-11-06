import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { U, anon, as, newProfile, resetAndSeed, setupEnv } from './helpers'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await setupEnv()
})
afterAll(async () => {
  await env.cleanup()
})
beforeEach(async () => {
  await resetAndSeed(env)
})

describe('perfil: alta (D-6)', () => {
  it('un usuario verificado crea su propio perfil pendiente', async () => {
    const db = as(env, U.newcomer)
    await assertSucceeds(setDoc(doc(db, 'users', U.newcomer), newProfile(U.newcomer)))
  })

  it('sin verificar el correo no puede crear el perfil', async () => {
    const db = as(env, U.newcomer, false)
    await assertFails(setDoc(doc(db, 'users', U.newcomer), newProfile(U.newcomer)))
  })

  it('sin sesión no puede crear perfiles', async () => {
    await assertFails(setDoc(doc(anon(env), 'users', U.newcomer), newProfile(U.newcomer)))
  })

  it('no puede crear el perfil de otro usuario', async () => {
    const db = as(env, U.newcomer)
    await assertFails(setDoc(doc(db, 'users', 'u-ajeno'), newProfile('u-ajeno')))
  })

  it('no puede darse de alta como activo ni como admin', async () => {
    const db = as(env, U.newcomer)
    const ref = doc(db, 'users', U.newcomer)
    await assertFails(setDoc(ref, { ...newProfile(U.newcomer), status: 'active' }))
    await assertFails(setDoc(ref, { ...newProfile(U.newcomer), admin: true }))
    await assertFails(
      setDoc(ref, {
        ...newProfile(U.newcomer),
        approvedAt: serverTimestamp(),
        approvedBy: U.admin,
      }),
    )
  })

  it('el correo del perfil tiene que ser el de la sesión', async () => {
    const db = as(env, U.newcomer)
    await assertFails(
      setDoc(doc(db, 'users', U.newcomer), { ...newProfile(U.newcomer), email: 'otro@x.com' }),
    )
  })

  it('rechaza campos de más, de menos o fechas inventadas', async () => {
    const db = as(env, U.newcomer)
    const ref = doc(db, 'users', U.newcomer)
    await assertFails(setDoc(ref, { ...newProfile(U.newcomer), extra: 1 }))
    const sinPrefs: Record<string, unknown> = { ...newProfile(U.newcomer) }
    delete sinPrefs.prefs
    await assertFails(setDoc(ref, sinPrefs))
    await assertFails(
      setDoc(ref, {
        ...newProfile(U.newcomer),
        createdAt: Timestamp.fromDate(new Date(2020, 1, 1)),
      }),
    )
    await assertFails(setDoc(ref, { ...newProfile(U.newcomer), displayName: 'x'.repeat(101) }))
  })
})

describe('perfil: lectura', () => {
  it('cada usuario lee su perfil, aunque esté pendiente o bloqueado', async () => {
    await assertSucceeds(getDoc(doc(as(env, U.pending), 'users', U.pending)))
    await assertSucceeds(getDoc(doc(as(env, U.blocked), 'users', U.blocked)))
  })

  it('nadie lee el perfil de otro, salvo el admin', async () => {
    await assertFails(getDoc(doc(as(env, U.active), 'users', U.other)))
    await assertFails(getDoc(doc(anon(env), 'users', U.active)))
    await assertSucceeds(getDoc(doc(as(env, U.admin), 'users', U.active)))
  })

  it('solo el admin lista los perfiles', async () => {
    await assertSucceeds(getDocs(collection(as(env, U.admin), 'users')))
    await assertFails(getDocs(collection(as(env, U.active), 'users')))
    await assertFails(getDocs(collection(as(env, U.pending), 'users')))
  })

  it('un admin con el correo sin verificar no actúa como admin', async () => {
    await assertFails(getDocs(collection(as(env, U.admin, false), 'users')))
  })
})

describe('perfil: edición propia', () => {
  it('un usuario activo cambia sus preferencias y su nombre', async () => {
    const ref = doc(as(env, U.active), 'users', U.active)
    await assertSucceeds(updateDoc(ref, { 'prefs.theme': 'dark', displayName: 'Nuevo nombre' }))
    await assertSucceeds(updateDoc(ref, { 'prefs.startedCollapsed': true }))
  })

  it('un usuario activo arranca y para su cronómetro', async () => {
    const ref = doc(as(env, U.active), 'users', U.active)
    await assertSucceeds(
      updateDoc(ref, { activeTimer: { taskId: 't1', startedAt: serverTimestamp() } }),
    )
    await assertSucceeds(updateDoc(ref, { activeTimer: null }))
  })

  it('nadie cambia su propio estado, su admin, su correo ni su fecha de alta', async () => {
    const ref = doc(as(env, U.active), 'users', U.active)
    await assertFails(updateDoc(ref, { status: 'blocked' }))
    await assertFails(updateDoc(ref, { admin: true }))
    await assertFails(updateDoc(ref, { email: 'otro@x.com' }))
    await assertFails(updateDoc(ref, { createdAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(as(env, U.pending), 'users', U.pending), { status: 'active' }))
    await assertFails(updateDoc(doc(as(env, U.blocked), 'users', U.blocked), { status: 'active' }))
  })

  it('un usuario pendiente o bloqueado no edita su perfil', async () => {
    await assertFails(
      updateDoc(doc(as(env, U.pending), 'users', U.pending), { 'prefs.theme': 'dark' }),
    )
    await assertFails(
      updateDoc(doc(as(env, U.blocked), 'users', U.blocked), { 'prefs.theme': 'dark' }),
    )
  })

  it('rechaza preferencias o cronómetro con valores inválidos', async () => {
    const ref = doc(as(env, U.active), 'users', U.active)
    await assertFails(updateDoc(ref, { 'prefs.theme': 'rosa' }))
    await assertFails(updateDoc(ref, { 'prefs.hoursPerDay': 30 }))
    await assertFails(updateDoc(ref, { 'prefs.otra': true }))
    await assertFails(updateDoc(ref, { 'prefs.startedCollapsed': 'sí' }))
    await assertFails(updateDoc(ref, { activeTimer: { taskId: 't1' } }))
    await assertFails(updateDoc(ref, { extra: 1 }))
  })
})

describe('perfil: aprobación por el admin (D-2, D-8)', () => {
  it('el admin aprueba, bloquea y reactiva a otros', async () => {
    const ref = doc(as(env, U.admin), 'users', U.pending)
    await assertSucceeds(
      updateDoc(ref, { status: 'active', approvedAt: serverTimestamp(), approvedBy: U.admin }),
    )
    await assertSucceeds(updateDoc(ref, { status: 'blocked' }))
    await assertSucceeds(updateDoc(ref, { status: 'active' }))
  })

  it('el admin no da admin a nadie, ni cambia otros campos, ni pone estados inventados', async () => {
    const ref = doc(as(env, U.admin), 'users', U.active)
    await assertFails(updateDoc(ref, { admin: true }))
    await assertFails(updateDoc(ref, { displayName: 'Cambiado por el admin' }))
    await assertFails(updateDoc(ref, { status: 'superuser' }))
    await assertFails(updateDoc(ref, { status: 'active', approvedBy: 'otro-admin' }))
  })

  it('el admin no cambia su propio estado', async () => {
    await assertFails(updateDoc(doc(as(env, U.admin), 'users', U.admin), { status: 'blocked' }))
  })

  it('un usuario que no es admin no aprueba a nadie', async () => {
    await assertFails(updateDoc(doc(as(env, U.active), 'users', U.pending), { status: 'active' }))
  })
})

describe('perfil: baja (P-9)', () => {
  it('un usuario borra su propio perfil', async () => {
    await assertSucceeds(deleteDoc(doc(as(env, U.active), 'users', U.active)))
    await assertSucceeds(deleteDoc(doc(as(env, U.pending), 'users', U.pending)))
  })

  it('un usuario bloqueado no puede borrarse para volver a darse de alta', async () => {
    await assertFails(deleteDoc(doc(as(env, U.blocked), 'users', U.blocked)))
  })

  it('nadie borra el perfil de otro, ni siquiera el admin', async () => {
    await assertFails(deleteDoc(doc(as(env, U.active), 'users', U.other)))
    await assertFails(deleteDoc(doc(as(env, U.admin), 'users', U.active)))
  })
})
