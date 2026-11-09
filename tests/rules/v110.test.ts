import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { Timestamp, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { U, as, resetAndSeed, setupEnv, validTask } from './helpers'

/** Reglas de la v1.1.0 (plan TASKWAVE-02, D-8 a D-11, D-13). */

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

const taskRef = (id = 't1') => doc(as(env, U.active), 'users', U.active, 'tasks', id)

describe('campos opcionales de la tarea (D-8, D-9)', () => {
  it('una tarea sin los campos nuevos sigue siendo válida (datos antiguos)', async () => {
    await assertSucceeds(setDoc(taskRef(), validTask()))
    await assertSucceeds(
      updateDoc(taskRef(), { title: 'Otro título', updatedAt: serverTimestamp() }),
    )
  })

  it('acepta orden, semana planificada y recurrencia válidos', async () => {
    await assertSucceeds(
      setDoc(taskRef(), {
        ...validTask(),
        rank: 1500.5,
        plannedWeek: '2026-11-09',
        recurrence: { freq: 'week', interval: 2 },
      }),
    )
    await assertSucceeds(
      updateDoc(taskRef(), {
        rank: null,
        plannedWeek: null,
        recurrence: null,
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('rechaza valores raros y campos desconocidos', async () => {
    await assertFails(setDoc(taskRef('a'), { ...validTask(), rank: 'primero' }))
    await assertFails(setDoc(taskRef('b'), { ...validTask(), plannedWeek: '9-11-2026' }))
    await assertFails(
      setDoc(taskRef('c'), { ...validTask(), recurrence: { freq: 'hour', interval: 1 } }),
    )
    await assertFails(
      setDoc(taskRef('d'), { ...validTask(), recurrence: { freq: 'day', interval: 0 } }),
    )
    await assertFails(
      setDoc(taskRef('e'), {
        ...validTask(),
        recurrence: { freq: 'day', interval: 1, until: '2027-01-01' },
      }),
    )
    await assertFails(setDoc(taskRef('f'), { ...validTask(), color: 'red' }))
  })
})

describe('vista en las preferencias', () => {
  it('admite lista y backlog, pero no otras', async () => {
    const me = doc(as(env, U.active), 'users', U.active)
    await assertSucceeds(updateDoc(me, { 'prefs.view': 'list' }))
    await assertSucceeds(updateDoc(me, { 'prefs.view': 'backlog' }))
    await assertFails(updateDoc(me, { 'prefs.view': 'gantt' }))
  })
})

function validTemplate() {
  return {
    name: 'Revisión semanal',
    title: 'Revisar la semana',
    description: '- [ ] correo\n- [ ] tareas',
    priority: 'medium',
    estimateMin: 60,
    tagIds: ['tag1'],
    subtasks: ['Correo', 'Calendario'],
    createdAt: serverTimestamp(),
  }
}

describe('plantillas (D-10)', () => {
  const ref = (uid: string = U.active) => doc(as(env, uid), 'users', U.active, 'templates', 'tpl1')

  it('el dueño crea, edita y borra sus plantillas', async () => {
    await assertSucceeds(setDoc(ref(), validTemplate()))
    await assertSucceeds(setDoc(ref(), { ...validTemplate(), name: 'Otra' }))
  })

  it('valida los campos', async () => {
    await assertFails(setDoc(ref(), { ...validTemplate(), name: '' }))
    await assertFails(setDoc(ref(), { ...validTemplate(), priority: 'urgente' }))
    await assertFails(
      setDoc(ref(), { ...validTemplate(), subtasks: Array.from({ length: 31 }, () => 'x') }),
    )
    await assertFails(setDoc(ref(), { ...validTemplate(), extra: true }))
  })

  it('nadie más puede tocarlas', async () => {
    await assertFails(setDoc(ref(U.other), validTemplate()))
    await assertFails(setDoc(ref(U.admin), validTemplate()))
  })
})

function validTrash() {
  return {
    task: { ...validTask(), createdAt: Timestamp.now(), updatedAt: Timestamp.now() },
    comments: [{ body: 'hola', createdAt: Timestamp.now(), editedAt: null }],
    worklogs: [],
    deletedAt: serverTimestamp(),
  }
}

describe('papelera (D-11)', () => {
  const ref = (uid: string = U.active) => doc(as(env, uid), 'users', U.active, 'trash', 't1')

  it('el dueño manda una tarea a la papelera, pero no la edita después', async () => {
    await assertSucceeds(setDoc(ref(), validTrash()))
    await assertFails(updateDoc(ref(), { comments: [] }))
  })

  it('la fecha de borrado es la del servidor y los campos son los esperados', async () => {
    await assertFails(setDoc(ref(), { ...validTrash(), deletedAt: Timestamp.now() }))
    await assertFails(setDoc(ref(), { ...validTrash(), task: 'texto' }))
    await assertFails(setDoc(ref(), { ...validTrash(), extra: 1 }))
  })

  it('nadie más puede verla ni escribir en ella', async () => {
    await assertFails(setDoc(ref(U.other), validTrash()))
  })
})
