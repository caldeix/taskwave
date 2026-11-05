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
  type Firestore,
} from 'firebase/firestore'
import {
  U,
  anon,
  as,
  resetAndSeed,
  setupEnv,
  validActivity,
  validComment,
  validProject,
  validTag,
  validTask,
  validWorklog,
} from './helpers'

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

/**
 * Espera a que cambie el milisegundo. Si una escritura sin marca cae en el mismo milisegundo que
 * la anterior, la marca guardada ya coincide con `request.time` y la regla la acepta (el dato es
 * correcto igualmente). Sin esta espera, los tests negativos de marcas fallarían a ratos.
 */
const nextMillisecond = () => new Promise((resolve) => setTimeout(resolve, 5))

/** Crea con las reglas activas una tarea del usuario activo (para probar sus subcolecciones). */
async function createActiveTask(): Promise<Firestore> {
  const db = as(env, U.active)
  await setDoc(doc(db, 'users', U.active, 'tasks', 't1'), validTask())
  return db
}

describe('propiedad y estado de la cuenta (D-7, D-10)', () => {
  const collections = [
    ['projects', validProject],
    ['tasks', validTask],
    ['worklogs', validWorklog],
    ['tags', validTag],
  ] as const

  it.each(collections)('un usuario activo crea, lee y borra sus %s', async (name, make) => {
    const db = as(env, U.active)
    const ref = doc(db, 'users', U.active, name, 'x1')
    await assertSucceeds(setDoc(ref, make()))
    await assertSucceeds(getDoc(ref))
    await assertSucceeds(getDocs(collection(db, 'users', U.active, name)))
    await assertSucceeds(deleteDoc(ref))
  })

  it.each(collections)(
    'nadie más accede a los %s de un usuario, ni el admin',
    async (name, make) => {
      for (const intruder of [as(env, U.other), as(env, U.admin), anon(env)]) {
        await assertFails(getDocs(collection(intruder, 'users', U.active, name)))
        await assertFails(setDoc(doc(intruder, 'users', U.active, name, 'x1'), make()))
      }
    },
  )

  it.each(collections)('un usuario pendiente o bloqueado no usa sus %s', async (name, make) => {
    for (const uid of [U.pending, U.blocked]) {
      const db = as(env, uid)
      await assertFails(setDoc(doc(db, 'users', uid, name, 'x1'), make()))
      await assertFails(getDocs(collection(db, 'users', uid, name)))
    }
  })

  it('con el correo sin verificar no hay acceso a los datos', async () => {
    const db = as(env, U.active, false)
    await assertFails(getDocs(collection(db, 'users', U.active, 'tasks')))
  })

  it('las rutas fuera de users/{uid} están cerradas', async () => {
    const db = as(env, U.admin)
    await assertFails(setDoc(doc(db, 'config', 'global'), { a: 1 }))
    await assertFails(getDoc(doc(db, 'config', 'global')))
  })
})

describe('validación de proyectos', () => {
  const ref = () => doc(as(env, U.active), 'users', U.active, 'projects', 'p1')

  it('rechaza claves, colores y nombres no válidos', async () => {
    await assertFails(setDoc(ref(), { ...validProject(), key: 'est' }))
    await assertFails(setDoc(ref(), { ...validProject(), key: 'DEMASIADO' }))
    await assertFails(setDoc(ref(), { ...validProject(), color: 'rosa' }))
    await assertFails(setDoc(ref(), { ...validProject(), name: '' }))
    await assertFails(setDoc(ref(), { ...validProject(), name: 'x'.repeat(61) }))
    await assertFails(setDoc(ref(), { ...validProject(), extra: true }))
  })

  it('la fecha de creación la pone el servidor y luego no cambia', async () => {
    await assertFails(
      setDoc(ref(), { ...validProject(), createdAt: Timestamp.fromDate(new Date(2020, 0, 1)) }),
    )
    await assertSucceeds(setDoc(ref(), validProject()))
    await assertSucceeds(updateDoc(ref(), { name: 'Otro nombre', archived: true }))
    await assertFails(updateDoc(ref(), { createdAt: serverTimestamp() }))
  })
})

describe('validación de tareas', () => {
  const ref = () => doc(as(env, U.active), 'users', U.active, 'tasks', 't1')

  it('acepta una tarea sin proyecto, sin fechas y sin estimado', async () => {
    await assertSucceeds(
      setDoc(ref(), {
        ...validTask(),
        key: 'INB-3',
        projectId: null,
        startDate: null,
        endDate: null,
        estimateMin: null,
      }),
    )
  })

  it('rechaza estados, prioridades y claves inventadas', async () => {
    await assertFails(setDoc(ref(), { ...validTask(), status: 'archivada' }))
    await assertFails(setDoc(ref(), { ...validTask(), priority: 'urgente' }))
    await assertFails(setDoc(ref(), { ...validTask(), key: 'tarea 1' }))
  })

  it('rechaza títulos vacíos o largos y descripciones enormes', async () => {
    await assertFails(setDoc(ref(), { ...validTask(), title: '' }))
    await assertFails(setDoc(ref(), { ...validTask(), title: 'x'.repeat(201) }))
    await assertFails(setDoc(ref(), { ...validTask(), description: 'x'.repeat(50001) }))
  })

  it('las fechas son de día (AAAA-MM-DD) y el fin no es anterior al inicio', async () => {
    await assertFails(setDoc(ref(), { ...validTask(), startDate: '05/11/2026' }))
    await assertFails(setDoc(ref(), { ...validTask(), startDate: '2026-13-01' }))
    await assertFails(setDoc(ref(), { ...validTask(), startDate: Timestamp.now() }))
    await assertFails(
      setDoc(ref(), { ...validTask(), startDate: '2026-11-07', endDate: '2026-11-05' }),
    )
  })

  it('limita las listas y no admite campos de más', async () => {
    await assertFails(
      setDoc(ref(), { ...validTask(), tagIds: Array.from({ length: 21 }, (_, i) => `t${i}`) }),
    )
    await assertFails(setDoc(ref(), { ...validTask(), estimateMin: -5 }))
    await assertFails(setDoc(ref(), { ...validTask(), spentMin: 1.5 }))
    await assertFails(setDoc(ref(), { ...validTask(), owner: 'otro' }))
  })

  it('las marcas de tiempo las pone el servidor y la creación no cambia', async () => {
    await assertFails(
      setDoc(ref(), { ...validTask(), createdAt: Timestamp.fromDate(new Date(2020, 0, 1)) }),
    )
    await assertSucceeds(setDoc(ref(), validTask()))
    await assertSucceeds(updateDoc(ref(), { status: 'in_progress', updatedAt: serverTimestamp() }))
    await nextMillisecond()
    await assertFails(updateDoc(ref(), { status: 'done' })) // sin actualizar updatedAt
    await assertFails(
      updateDoc(ref(), { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }),
    )
  })
})

describe('validación de comentarios', () => {
  it('se crean sin editar y al editar se marca la fecha de edición', async () => {
    const db = await createActiveTask()
    const ref = doc(db, 'users', U.active, 'tasks', 't1', 'comments', 'c1')
    await assertFails(setDoc(ref, { ...validComment(), editedAt: serverTimestamp() }))
    await assertSucceeds(setDoc(ref, validComment()))
    await assertSucceeds(updateDoc(ref, { body: 'Editado', editedAt: serverTimestamp() }))
    await nextMillisecond()
    await assertFails(updateDoc(ref, { body: 'Sin marca de edición' }))
    await assertFails(
      updateDoc(ref, { body: 'x', createdAt: serverTimestamp(), editedAt: serverTimestamp() }),
    )
  })

  it('rechaza comentarios vacíos o enormes', async () => {
    const db = await createActiveTask()
    const ref = doc(db, 'users', U.active, 'tasks', 't1', 'comments', 'c1')
    await assertFails(setDoc(ref, { ...validComment(), body: '' }))
    await assertFails(setDoc(ref, { ...validComment(), body: 'x'.repeat(10001) }))
  })

  it('otro usuario no comenta en tareas ajenas', async () => {
    await createActiveTask()
    const ref = doc(as(env, U.other), 'users', U.active, 'tasks', 't1', 'comments', 'c1')
    await assertFails(setDoc(ref, validComment()))
  })
})

describe('validación de la actividad (D-42)', () => {
  it('se crea con la hora del servidor y nunca se edita', async () => {
    const db = await createActiveTask()
    const ref = doc(db, 'users', U.active, 'tasks', 't1', 'activity', 'a1')
    await assertFails(
      setDoc(ref, { ...validActivity(), at: Timestamp.fromDate(new Date(2020, 0, 1)) }),
    )
    await assertSucceeds(setDoc(ref, validActivity()))
    await assertFails(updateDoc(ref, { to: 'done' }))
    await assertSucceeds(deleteDoc(ref))
  })

  it('acepta valores nulos, números y booleanos, pero no mapas', async () => {
    const db = await createActiveTask()
    const ref = (id: string) => doc(db, 'users', U.active, 'tasks', 't1', 'activity', id)
    await assertSucceeds(
      setDoc(ref('a1'), { ...validActivity(), field: 'estimateMin', from: null, to: 120 }),
    )
    await assertFails(setDoc(ref('a2'), { ...validActivity(), to: { trampa: true } }))
  })
})

describe('validación del registro de horas (D-27, D-29)', () => {
  const ref = () => doc(as(env, U.active), 'users', U.active, 'worklogs', 'w1')

  it('acepta registros del cronómetro y manuales, y se pueden editar', async () => {
    await assertSucceeds(setDoc(ref(), validWorklog()))
    await assertSucceeds(updateDoc(ref(), { minutes: 90, source: 'manual', note: 'Corregido' }))
  })

  it('un registro dura entre 1 minuto y 24 horas', async () => {
    await assertFails(setDoc(ref(), { ...validWorklog(), minutes: 0 }))
    await assertFails(setDoc(ref(), { ...validWorklog(), minutes: 1441 }))
  })

  it('el fin no es anterior al inicio y la fecha es de día', async () => {
    await assertFails(
      setDoc(ref(), {
        ...validWorklog(),
        startedAt: Timestamp.fromDate(new Date('2026-11-05T10:00:00')),
        endedAt: Timestamp.fromDate(new Date('2026-11-05T09:00:00')),
      }),
    )
    await assertFails(setDoc(ref(), { ...validWorklog(), date: '2026-11-5' }))
    await assertFails(setDoc(ref(), { ...validWorklog(), source: 'importado' }))
    await assertFails(setDoc(ref(), { ...validWorklog(), note: 'x'.repeat(501) }))
  })
})

describe('validación de tags', () => {
  const ref = () => doc(as(env, U.active), 'users', U.active, 'tags', 'g1')

  it('nombre corto y color del DS', async () => {
    await assertFails(setDoc(ref(), { ...validTag(), name: '' }))
    await assertFails(setDoc(ref(), { ...validTag(), name: 'x'.repeat(41) }))
    await assertFails(setDoc(ref(), { ...validTag(), color: '#ff0000' }))
    await assertSucceeds(setDoc(ref(), validTag()))
  })
})
