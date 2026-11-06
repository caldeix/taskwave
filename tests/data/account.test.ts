import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { deleteAccountData } from '@/data/account'
import {
  U,
  as,
  resetAndSeed,
  setupEnv,
  validActivity,
  validComment,
  validTag,
  validTask,
  validWorklog,
} from '../rules/helpers'

/** Baja de la cuenta (step-25, P-9) contra el emulador, con las reglas activas. */

let env: RulesTestEnvironment

async function countAll(uid: string) {
  let counts: Record<string, number> = {}
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore
    const user = doc(db, 'users', uid)
    const tasks = await getDocs(collection(user, 'tasks'))
    let children = 0
    for (const t of tasks.docs)
      children +=
        (await getDocs(collection(t.ref, 'comments'))).size +
        (await getDocs(collection(t.ref, 'activity'))).size
    counts = {
      profile: (await getDoc(user)).exists() ? 1 : 0,
      tasks: tasks.size,
      children,
      worklogs: (await getDocs(collection(user, 'worklogs'))).size,
      projects: (await getDocs(collection(user, 'projects'))).size,
      tags: (await getDocs(collection(user, 'tags'))).size,
    }
  })
  return counts
}

beforeAll(async () => {
  env = await setupEnv()
})
afterAll(async () => {
  await env.cleanup()
})
beforeEach(async () => {
  await resetAndSeed(env)
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore
    for (const uid of [U.active, U.other]) {
      const batch = writeBatch(db)
      const user = doc(db, 'users', uid)
      for (let i = 0; i < 12; i++) {
        const task = doc(collection(user, 'tasks'), `t${i}`)
        batch.set(task, { ...validTask(), key: `EST-${i + 1}` })
        batch.set(doc(collection(task, 'comments')), validComment())
        batch.set(doc(collection(task, 'activity')), validActivity())
        batch.set(doc(collection(user, 'worklogs')), { ...validWorklog(), taskId: `t${i}` })
      }
      batch.set(doc(collection(user, 'projects'), 'p1'), {
        name: 'Estudio',
        key: 'EST',
        color: 'blue',
        icon: 'folder',
        order: 0,
        archived: false,
        taskCounter: 12,
        createdAt: Timestamp.now(),
      })
      batch.set(doc(collection(user, 'tags'), 'uni'), validTag())
      await batch.commit()
    }
  })
})

describe('deleteAccountData (P-9, CA-18)', () => {
  it('borra todos los datos y el perfil, y no toca los de otro usuario', async () => {
    expect(await countAll(U.active)).toEqual({
      profile: 1,
      tasks: 12,
      children: 24,
      worklogs: 12,
      projects: 1,
      tags: 1,
    })
    const counts = await deleteAccountData(as(env, U.active), U.active)
    expect(counts).toEqual({
      tasks: 12,
      comments: 12,
      activity: 12,
      worklogs: 12,
      projects: 1,
      tags: 1,
    })
    expect(await countAll(U.active)).toEqual({
      profile: 0,
      tasks: 0,
      children: 0,
      worklogs: 0,
      projects: 0,
      tags: 0,
    })
    expect((await countAll(U.other)).tasks).toBe(12)
  })

  it('nadie puede borrar los datos de otro', async () => {
    await expect(deleteAccountData(as(env, U.other), U.active)).rejects.toThrow()
    expect((await countAll(U.active)).tasks).toBe(12)
  })

  it('un usuario bloqueado no puede darse de baja (P-9)', async () => {
    await expect(deleteAccountData(as(env, U.blocked), U.blocked)).rejects.toThrow()
  })
})
