import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  type Firestore,
} from 'firebase/firestore'
import { exportBackup, importBackup } from '@/data/backup'
import { parseBackup, isBackupError } from '@/domain/backup'
import {
  U,
  as,
  resetAndSeed,
  setupEnv,
  validComment,
  validProject,
  validTag,
  validTask,
  validWorklog,
} from '../rules/helpers'

/** Exportar e importar (v1.1.0, D-12) contra el emulador, con las reglas activas. */

let env: RulesTestEnvironment

async function admin<T>(run: (db: Firestore) => Promise<T>): Promise<T> {
  let out: T
  await env.withSecurityRulesDisabled(async (ctx) => {
    out = await run(ctx.firestore() as unknown as Firestore)
  })
  return out!
}

beforeAll(async () => {
  env = await setupEnv()
})
afterAll(async () => {
  await env.cleanup()
})
beforeEach(async () => {
  await resetAndSeed(env)
  await admin(async (db) => {
    const u = (...p: string[]) => doc(db, 'users', U.active, ...p)
    const now = Timestamp.now()
    await setDoc(u('projects', 'p1'), { ...validProject(), taskCounter: 2, createdAt: now })
    await setDoc(u('tags', 'g1'), validTag())
    const base = { ...validTask(), createdAt: now, updatedAt: now }
    await setDoc(u('tasks', 'P'), {
      ...base,
      key: 'EST-1',
      links: [{ type: 'relates', taskId: 'S' }],
    })
    await setDoc(u('tasks', 'S'), {
      ...base,
      key: 'EST-2',
      parentId: 'P',
      links: [{ type: 'relates', taskId: 'P' }],
    })
    await setDoc(u('tasks', 'P', 'comments', 'c1'), { ...validComment(), createdAt: now })
    await setDoc(u('worklogs', 'w1'), { ...validWorklog(), taskId: 'P' })
  })
})

describe('copia de seguridad (idea 10)', () => {
  it('exporta todo y lo vuelve a importar sin pisar lo que existe', async () => {
    const db = as(env, U.active)
    const backup = await exportBackup(db, U.active, '1.1.0')
    expect(backup.tasks.map((t) => t.id).sort()).toEqual(['P', 'S'])
    expect(backup.tasks.find((t) => t.id === 'P')?.comments).toHaveLength(1)
    // La copia pasa por JSON como en un fichero.
    const parsed = parseBackup(JSON.stringify(backup))
    if (isBackupError(parsed)) throw new Error(parsed)

    // Se pierde todo menos el proyecto.
    await admin(async (a) => {
      const u = (...p: string[]) => doc(a, 'users', U.active, ...p)
      for (const path of [
        ['tasks', 'P', 'comments', 'c1'],
        ['tasks', 'S'],
        ['tasks', 'P'],
        ['worklogs', 'w1'],
        ['tags', 'g1'],
      ])
        await deleteDoc(u(...path))
    })

    const summary = await importBackup(db, U.active, parsed)
    expect(summary).toEqual({
      projects: 0,
      tags: 1,
      tasks: 2,
      comments: 1,
      worklogs: 1,
      templates: 0,
      skippedKeys: [],
    })

    const after = await admin(async (a) => {
      const u = (...p: string[]) => doc(a, 'users', U.active, ...p)
      return {
        s: (await getDoc(u('tasks', 'S'))).data(),
        comments: (await getDocs(collection(a, 'users', U.active, 'tasks', 'P', 'comments'))).size,
        worklog: (await getDoc(u('worklogs', 'w1'))).data(),
      }
    })
    expect(after.s).toMatchObject({
      key: 'EST-2',
      parentId: 'P',
      links: [{ type: 'relates', taskId: 'P' }],
    })
    expect(after.comments).toBe(1)
    expect(after.worklog?.startedAt).toBeInstanceOf(Timestamp)

    // Importar otra vez no crea nada.
    const again = await importBackup(db, U.active, parsed)
    expect(again.tasks + again.tags + again.comments + again.worklogs).toBe(0)
  })

  it('no importa una tarea cuya clave ya usa otra', async () => {
    const db = as(env, U.active)
    const backup = await exportBackup(db, U.active, '1.1.0')
    const parsed = parseBackup(JSON.stringify(backup))
    if (isBackupError(parsed)) throw new Error(parsed)
    // Otra tarea ocupa EST-2.
    await admin(async (a) => {
      await deleteDoc(doc(a, 'users', U.active, 'tasks', 'S'))
      await setDoc(doc(a, 'users', U.active, 'tasks', 'OTRA'), {
        ...validTask(),
        key: 'EST-2',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
    })
    const summary = await importBackup(db, U.active, parsed)
    expect(summary.tasks).toBe(0)
    expect(summary.skippedKeys).toEqual(['EST-2'])
  })

  it('otro usuario no puede importar en mi cuenta', async () => {
    const backup = await exportBackup(as(env, U.active), U.active, '1.1.0')
    await expect(importBackup(as(env, U.other), U.active, backup)).rejects.toThrow()
  })
})
