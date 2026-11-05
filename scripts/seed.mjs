/**
 * Datos de prueba para la Emulator Suite (step-3 del plan TASKWAVE-01).
 *
 * Uso: con los emuladores arrancados (`npm run emulators`), en otra terminal `npm run seed`.
 * Borra todo lo que haya en los emuladores y crea usuarios, proyectos, tags, tareas, horas,
 * comentarios y actividad siguiendo el modelo del apartado «Impacto en BD» del plan.
 *
 * Solo funciona contra los emuladores y con un proyecto `demo-*`: nunca toca producción.
 * Las fechas se calculan respecto a hoy (mes anterior, actual y siguiente) para que los datos
 * sigan siendo útiles en cualquier momento.
 */
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const PROJECT_ID = 'demo-taskwave'
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099'

// Contraseña común de los usuarios de prueba (solo existen en el emulador).
const TEST_PASSWORD = 'taskwave-demo-2026'

const TEST_USERS = [
  {
    key: 'admin',
    email: 'admin@taskwave.test',
    name: 'Admin de prueba',
    status: 'active',
    admin: true,
  },
  {
    key: 'active',
    email: 'activo@taskwave.test',
    name: 'Usuario activo',
    status: 'active',
    admin: false,
  },
  {
    key: 'pending',
    email: 'pendiente@taskwave.test',
    name: 'Usuario pendiente',
    status: 'pending',
    admin: false,
  },
  {
    key: 'blocked',
    email: 'bloqueado@taskwave.test',
    name: 'Usuario bloqueado',
    status: 'blocked',
    admin: false,
  },
]

// ---------------------------------------------------------------- seguridad

process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST
// Sin credenciales de Google Cloud: evita que el Admin SDK busque el servidor de metadatos.
process.env.METADATA_SERVER_DETECTION = 'none'
if (!PROJECT_ID.startsWith('demo-')) {
  throw new Error('El seed solo puede ejecutarse contra un proyecto demo-* de los emuladores.')
}

async function assertEmulatorsUp() {
  try {
    await fetch(`http://${FIRESTORE_HOST}/`)
    await fetch(`http://${AUTH_HOST}/`)
  } catch {
    console.error('No se encuentran los emuladores. Arráncalos antes con `npm run emulators`.')
    process.exit(1)
  }
}

async function resetEmulators() {
  const fs = await fetch(
    `http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  )
  const au = await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
    method: 'DELETE',
  })
  if (!fs.ok || !au.ok)
    throw new Error(`No se pudieron vaciar los emuladores (${fs.status}/${au.status})`)
}

// ---------------------------------------------------------------- utilidades

/** PRNG determinista (mulberry32) para que el seed genere siempre lo mismo. */
function rng(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = rng(20261105)
const pick = (list) => list[Math.floor(rand() * list.length)]
const between = (min, max) => min + Math.floor(rand() * (max - min + 1))

const today = new Date()
today.setHours(0, 0, 0, 0)

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}
/** Fecha de día como `AAAA-MM-DD` en hora local (Europe/Madrid en el equipo del usuario). */
function ymd(date) {
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}
function at(date, hours, minutes = 0) {
  const d = new Date(date)
  d.setHours(hours, minutes, 0, 0)
  return d
}
const ts = (date) => Timestamp.fromDate(date)

// ---------------------------------------------------------------- catálogo

const PROJECTS = [
  { key: 'EST', name: 'Estudio', color: 'blue', icon: 'book-open' },
  { key: 'CASA', name: 'Casa', color: 'emerald', icon: 'home' },
  { key: 'TRB', name: 'Trabajo', color: 'violet', icon: 'briefcase' },
]

const TAGS = [
  { id: 'tag-universidad', name: 'universidad', color: 'blue' },
  { id: 'tag-salud', name: 'salud', color: 'emerald' },
  { id: 'tag-urgente', name: 'urgente', color: 'coral' },
  { id: 'tag-lectura', name: 'lectura', color: 'violet' },
  { id: 'tag-tramites', name: 'trámites', color: 'mustard' },
]

const TITLES = {
  EST: [
    'Estudiar tema',
    'Hacer ejercicios del tema',
    'Repasar apuntes de',
    'Preparar examen de',
    'Entregar práctica de',
    'Leer capítulo de',
  ],
  CASA: ['Limpiar', 'Comprar', 'Arreglar', 'Pagar', 'Ordenar', 'Revisar'],
  TRB: [
    'Revisar incidencia',
    'Preparar reunión de',
    'Documentar',
    'Desplegar',
    'Analizar',
    'Planificar',
  ],
  INB: ['Llamar a', 'Mirar', 'Apuntarse a', 'Contestar a'],
}
const OBJECTS = {
  EST: ['Estadística', 'Bases de datos', 'Redes', 'Álgebra', 'Sistemas operativos', 'Inglés'],
  CASA: [
    'la cocina',
    'el baño',
    'la compra semanal',
    'el seguro del coche',
    'el armario',
    'la caldera',
  ],
  TRB: [
    'facturación',
    'el sprint',
    'la API de clientes',
    'la versión 2.3',
    'los logs',
    'el trimestre',
  ],
  INB: ['el banco', 'el gimnasio', 'el curso de Vue', 'Marta'],
}

const DESCRIPTION = `## Objetivo

Descripción de prueba en **markdown** con una lista:

- Punto uno
- Punto dos con \`código\`

### Checklist

- [x] Primer paso
- [ ] Segundo paso
- [ ] Tercer paso

[Enlace de ejemplo](https://example.com)
`

// ---------------------------------------------------------------- generación

function buildTasks() {
  /** @type {any[]} */
  const tasks = []
  const counters = { EST: 0, CASA: 0, TRB: 0, INB: 0 }

  function makeTask(projectKey, overrides = {}) {
    counters[projectKey] += 1
    const key = `${projectKey}-${counters[projectKey]}`
    const title = `${pick(TITLES[projectKey])} ${pick(OBJECTS[projectKey])}`
    const task = {
      id: `task-${key.toLowerCase()}`,
      key,
      projectKey,
      title,
      description: rand() < 0.6 ? DESCRIPTION : '',
      status: 'pending',
      priority: pick(['high', 'medium', 'medium', 'low']),
      startDate: null,
      endDate: null,
      estimateMin: null,
      tagIds: [],
      links: [],
      parentId: null,
      weblinks: [],
      resolvedAt: null,
      ...overrides,
    }
    tasks.push(task)
    return task
  }

  // 54 tareas repartidas entre el mes anterior, el actual y el siguiente.
  for (let i = 0; i < 54; i++) {
    const projectKey = pick(['EST', 'EST', 'CASA', 'TRB', 'TRB', 'INB'])
    const start = addDays(today, between(-45, 40))
    const hasEnd = rand() < 0.65
    const end = hasEnd ? addDays(start, between(0, 6)) : null
    const inPast = start < today
    let status
    if (!inPast) status = rand() < 0.85 ? 'pending' : 'in_progress'
    else
      status = pick([
        'in_progress',
        'in_progress',
        'paused',
        'done',
        'done',
        'done',
        'discarded',
        'ko',
        'pending',
      ])

    makeTask(projectKey, {
      status,
      startDate: ymd(start),
      endDate: end ? ymd(end) : null,
      estimateMin: rand() < 0.75 ? pick([30, 60, 90, 120, 240, 480, 960, 1200]) : null,
      tagIds: TAGS.filter(() => rand() < 0.25).map((t) => t.id),
      weblinks: rand() < 0.2 ? [{ url: 'https://example.com/doc', title: 'Documentación' }] : [],
      resolvedAt: ['done', 'discarded', 'ko'].includes(status) ? (end ?? start) : null,
    })
  }

  // Casos especiales que el plan pide cubrir.
  const multiDay = makeTask('EST', {
    title: 'Semana de exámenes (tarea de varios días)',
    status: 'in_progress',
    startDate: ymd(addDays(today, -2)),
    endDate: ymd(addDays(today, 4)),
    estimateMin: 1200,
    tagIds: ['tag-universidad', 'tag-urgente'],
    description: DESCRIPTION,
  })
  const study = makeTask('EST', {
    title: 'Estudiar (cruza la medianoche)',
    status: 'in_progress',
    startDate: ymd(addDays(today, -10)),
    endDate: null,
    estimateMin: 1200,
    tagIds: ['tag-universidad'],
  })
  const sub1 = makeTask('EST', {
    title: 'Subtarea: resumen del tema 1',
    status: 'done',
    startDate: ymd(addDays(today, -9)),
    endDate: ymd(addDays(today, -8)),
    estimateMin: 120,
    parentId: study.id,
    resolvedAt: addDays(today, -8),
  })
  const sub2 = makeTask('EST', {
    title: 'Subtarea: ejercicios del tema 2',
    status: 'in_progress',
    startDate: ymd(addDays(today, -3)),
    estimateMin: 180,
    parentId: study.id,
  })
  const blocker = makeTask('TRB', {
    title: 'Corregir el error de la API (bloquea el despliegue)',
    status: 'ko',
    startDate: ymd(addDays(today, -6)),
    endDate: ymd(addDays(today, -5)),
    estimateMin: 240,
    tagIds: ['tag-urgente'],
    resolvedAt: addDays(today, -5),
  })
  const deploy = makeTask('TRB', {
    title: 'Desplegar la versión 2.3',
    status: 'paused',
    startDate: ymd(addDays(today, -4)),
    endDate: ymd(addDays(today, -1)), // atrasada
    estimateMin: 120,
  })
  makeTask('INB', { title: 'Tarea sin fecha en la bandeja', status: 'pending' })
  makeTask('CASA', { title: 'Tarea sin fecha con estimado', status: 'pending', estimateMin: 90 })

  // Vínculos bidireccionales (D-41).
  const link = (a, typeAB, b, typeBA) => {
    a.links.push({ type: typeAB, taskId: b.id })
    b.links.push({ type: typeBA, taskId: a.id })
  }
  link(blocker, 'blocks', deploy, 'blocked_by')
  link(blocker, 'causes', deploy, 'caused_by')
  link(multiDay, 'relates', study, 'relates')

  return { tasks, counters, special: { multiDay, study, sub1, sub2, blocker, deploy } }
}

function buildWorklogs(tasks, special) {
  /** @type {any[]} */
  const worklogs = []
  let n = 0
  const add = (task, start, minutes, source = 'timer', note = '') => {
    const end = new Date(start.getTime() + minutes * 60000)
    worklogs.push({
      id: `wl-${String(++n).padStart(4, '0')}`,
      taskId: task.id,
      projectKey: task.projectKey,
      date: ymd(start),
      minutes,
      startedAt: start,
      endedAt: end,
      source,
      note,
    })
  }

  for (const task of tasks) {
    if (task.status === 'pending' || !task.startDate || task === special.study) continue
    const start = new Date(`${task.startDate}T00:00:00`)
    const last = task.endDate ? new Date(`${task.endDate}T00:00:00`) : today
    const until = last < today ? last : today
    const days = Math.max(0, Math.round((until.getTime() - start.getTime()) / 86400000))
    const sessions = between(1, Math.min(4, days + 1))
    for (let s = 0; s < sessions; s++) {
      const day = addDays(start, between(0, days))
      add(
        task,
        at(day, between(8, 19), pick([0, 15, 30, 45])),
        pick([25, 45, 60, 90, 120]),
        rand() < 0.8 ? 'timer' : 'manual',
      )
    }
  }

  // «Estudiar»: 4 h hoy y una sesión de 23:00 a 01:00 partida en dos registros (D-27).
  const yesterday = addDays(today, -1)
  add(special.study, at(addDays(today, -7), 17), 120)
  add(special.study, at(addDays(today, -4), 18), 90, 'manual', 'Repaso en la biblioteca')
  add(special.study, at(yesterday, 23), 60, 'timer', 'Sesión que cruza la medianoche (parte 1)')
  add(special.study, at(today, 0), 60, 'timer', 'Sesión que cruza la medianoche (parte 2)')
  add(special.study, at(today, 9), 240)

  return worklogs
}

// ---------------------------------------------------------------- escritura

async function seedUser(db, auth, user) {
  const record = await auth.createUser({
    email: user.email,
    password: TEST_PASSWORD,
    displayName: user.name,
    emailVerified: true,
  })
  const uid = record.uid
  const now = new Date()
  await db.doc(`users/${uid}`).set({
    email: user.email,
    displayName: user.name,
    photoURL: null,
    provider: 'password',
    status: user.status,
    admin: user.admin,
    createdAt: ts(addDays(now, -30)),
    approvedAt: user.status === 'active' ? ts(addDays(now, -29)) : null,
    approvedBy: null,
    inboxCounter: 0,
    prefs: {
      theme: 'system',
      view: 'calendar',
      sidebarCollapsed: false,
      hoursPerDay: 8,
      timerWarnHours: 8,
      filters: null,
    },
    activeTimer: null,
  })
  return uid
}

async function seedWorkspace(db, uid, { full }) {
  const writer = db.bulkWriter()
  const base = `users/${uid}`
  const { tasks, counters, special } = buildTasks()
  const chosen = full ? tasks : tasks.slice(0, 5)

  const projectIds = {}
  PROJECTS.forEach((p, i) => {
    const id = `project-${p.key.toLowerCase()}`
    projectIds[p.key] = id
    writer.set(db.doc(`${base}/projects/${id}`), {
      name: p.name,
      key: p.key,
      color: p.color,
      icon: p.icon,
      order: i,
      archived: false,
      taskCounter: counters[p.key],
      createdAt: ts(addDays(today, -60)),
    })
  })
  writer.update(db.doc(base), { inboxCounter: counters.INB })

  for (const tag of TAGS)
    writer.set(db.doc(`${base}/tags/${tag.id}`), { name: tag.name, color: tag.color })

  const worklogs = full ? buildWorklogs(chosen, special) : []
  const spent = new Map()
  const lastWorked = new Map()
  for (const wl of worklogs) {
    spent.set(wl.taskId, (spent.get(wl.taskId) ?? 0) + wl.minutes)
    if (!lastWorked.has(wl.taskId) || lastWorked.get(wl.taskId) < wl.endedAt)
      lastWorked.set(wl.taskId, wl.endedAt)
  }

  for (const t of chosen) {
    const created = t.startDate
      ? addDays(new Date(`${t.startDate}T00:00:00`), -2)
      : addDays(today, -15)
    writer.set(db.doc(`${base}/tasks/${t.id}`), {
      key: t.key,
      projectId: t.projectKey === 'INB' ? null : projectIds[t.projectKey],
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      startDate: t.startDate,
      endDate: t.endDate,
      estimateMin: t.estimateMin,
      spentMin: spent.get(t.id) ?? 0,
      lastWorkedAt: lastWorked.has(t.id) ? ts(lastWorked.get(t.id)) : null,
      tagIds: t.tagIds,
      links: t.links,
      parentId: t.parentId,
      weblinks: t.weblinks,
      resolvedAt: t.resolvedAt ? ts(t.resolvedAt) : null,
      createdAt: ts(created),
      updatedAt: ts(created),
    })
  }

  for (const wl of worklogs) {
    writer.set(db.doc(`${base}/worklogs/${wl.id}`), {
      taskId: wl.taskId,
      projectId: wl.projectKey === 'INB' ? null : projectIds[wl.projectKey],
      date: wl.date,
      minutes: wl.minutes,
      startedAt: ts(wl.startedAt),
      endedAt: ts(wl.endedAt),
      source: wl.source,
      note: wl.note,
    })
  }

  if (full) {
    const { study, deploy } = special
    const comments = [
      {
        task: study,
        body: 'Primer comentario en **markdown**.',
        created: addDays(today, -6),
        edited: null,
      },
      {
        task: study,
        body: 'Comentario editado con una lista:\n\n- uno\n- dos',
        created: addDays(today, -3),
        edited: addDays(today, -2),
      },
      {
        task: deploy,
        body: 'Paralizada hasta que se corrija la API.',
        created: addDays(today, -3),
        edited: null,
      },
    ]
    comments.forEach((c, i) =>
      writer.set(db.doc(`${base}/tasks/${c.task.id}/comments/c-${i + 1}`), {
        body: c.body,
        createdAt: ts(at(c.created, 10 + i)),
        editedAt: c.edited ? ts(at(c.edited, 12)) : null,
      }),
    )
    const activity = [
      { task: deploy, field: 'status', from: 'in_progress', to: 'paused', at: addDays(today, -3) },
      {
        task: deploy,
        field: 'endDate',
        from: ymd(addDays(today, -3)),
        to: ymd(addDays(today, -1)),
        at: addDays(today, -3),
      },
      { task: study, field: 'status', from: 'pending', to: 'in_progress', at: addDays(today, -7) },
    ]
    activity.forEach((a, i) =>
      writer.set(db.doc(`${base}/tasks/${a.task.id}/activity/a-${i + 1}`), {
        field: a.field,
        from: a.from,
        to: a.to,
        at: ts(at(a.at, 11)),
      }),
    )
  }

  await writer.close()
  return { tasks: chosen.length, worklogs: worklogs.length }
}

// ---------------------------------------------------------------- main

await assertEmulatorsUp()
await resetEmulators()

initializeApp({ projectId: PROJECT_ID })
const auth = getAuth()
const db = getFirestore()

for (const user of TEST_USERS) {
  const uid = await seedUser(db, auth, user)
  if (user.key === 'admin') {
    const r = await seedWorkspace(db, uid, { full: true })
    console.log(`✔ ${user.email}: ${r.tasks} tareas, ${r.worklogs} registros de horas`)
  } else if (user.key === 'active') {
    const r = await seedWorkspace(db, uid, { full: false })
    console.log(`✔ ${user.email}: ${r.tasks} tareas`)
  } else {
    console.log(`✔ ${user.email}: estado ${user.status}`)
  }
}
console.log(
  'Datos de prueba creados. Contraseña común: la constante TEST_PASSWORD de scripts/seed.mjs',
)
