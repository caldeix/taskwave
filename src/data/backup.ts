import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  Timestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import {
  BACKUP_APP,
  BACKUP_FORMAT,
  fromJsonValue,
  keyNumber,
  toJsonValue,
  type Backup,
  type Doc,
} from '@/domain/backup'
import type { TaskLink } from '@/domain/task'

/**
 * Exportar e importar (plan TASKWAVE-02, idea 10, D-12, CA-10a). La copia lleva proyectos, tags,
 * tareas (con sus comentarios), horas y plantillas. Importar crea solo lo que no existe (por id) y
 * nunca toca lo que ya hay.
 */

const asDoc = (id: string, data: Record<string, unknown>): Doc =>
  ({ id, ...(toJsonValue(data) as Record<string, unknown>) }) as Doc

export async function exportBackup(db: Firestore, uid: string, version: string): Promise<Backup> {
  const user = (name: string) => collection(db, 'users', uid, name)
  const [projects, tags, tasks, worklogs, templates] = await Promise.all(
    ['projects', 'tags', 'tasks', 'worklogs', 'templates'].map((name) => getDocs(user(name))),
  )
  const withComments = await Promise.all(
    tasks!.docs.map(async (d) => {
      const comments = await getDocs(collection(d.ref, 'comments'))
      return { ...asDoc(d.id, d.data()), comments: comments.docs.map((c) => asDoc(c.id, c.data())) }
    }),
  )
  return {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    version,
    exportedAt: new Date().toISOString(),
    projects: projects!.docs.map((d) => asDoc(d.id, d.data())),
    tags: tags!.docs.map((d) => asDoc(d.id, d.data())),
    tasks: withComments,
    worklogs: worklogs!.docs.map((d) => asDoc(d.id, d.data())),
    templates: templates!.docs.map((d) => asDoc(d.id, d.data())),
  }
}

export interface ImportSummary {
  projects: number
  tags: number
  tasks: number
  comments: number
  worklogs: number
  templates: number
  /** Tareas que no se importan porque su clave ya la usa otra tarea (R-3). */
  skippedKeys: string[]
}

const BATCH = 400
const restore = (value: unknown) => fromJsonValue(value, (ms) => Timestamp.fromMillis(ms))
/** Datos del documento sin su `id` (que va en la ruta) y con las marcas de tiempo restauradas. */
function strip(source: Doc): Record<string, unknown> {
  const data: Record<string, unknown> = { ...source }
  delete data.id
  return restore(data) as Record<string, unknown>
}

type Write = { path: string[]; data: Record<string, unknown> }

async function commitAll(db: Firestore, writes: Write[]): Promise<void> {
  for (let i = 0; i < writes.length; i += BATCH) {
    const batch = writeBatch(db)
    for (const w of writes.slice(i, i + BATCH)) {
      const [first, ...rest] = w.path
      batch.set(doc(db, first!, ...rest), w.data)
    }
    await batch.commit()
  }
}

export async function importBackup(
  db: Firestore,
  uid: string,
  backup: Backup,
): Promise<ImportSummary> {
  const user = (name: string) => collection(db, 'users', uid, name)
  const [projects, tags, tasks, worklogs, templates] = await Promise.all(
    ['projects', 'tags', 'tasks', 'worklogs', 'templates'].map((name) => getDocs(user(name))),
  )
  const ids = (snap: typeof projects) => new Set(snap!.docs.map((d) => d.id))
  const existing = {
    projects: ids(projects),
    tags: ids(tags),
    tasks: ids(tasks),
    worklogs: ids(worklogs),
    templates: ids(templates),
  }
  const usedKeys = new Map(tasks!.docs.map((d) => [String(d.data().key), d.id]))
  const summary: ImportSummary = {
    projects: 0,
    tags: 0,
    tasks: 0,
    comments: 0,
    worklogs: 0,
    templates: 0,
    skippedKeys: [],
  }
  const base = ['users', uid]
  const now = serverTimestamp()

  // 1. Proyectos, tags y plantillas (las reglas exigen la fecha de alta del servidor).
  const first: Write[] = []
  for (const p of backup.projects)
    if (!existing.projects.has(p.id)) {
      first.push({ path: [...base, 'projects', p.id], data: { ...strip(p), createdAt: now } })
      summary.projects++
    }
  for (const t of backup.tags)
    if (!existing.tags.has(t.id)) {
      first.push({ path: [...base, 'tags', t.id], data: strip(t) })
      summary.tags++
    }
  for (const t of backup.templates)
    if (!existing.templates.has(t.id)) {
      first.push({ path: [...base, 'templates', t.id], data: { ...strip(t), createdAt: now } })
      summary.templates++
    }
  await commitAll(db, first)

  // 2. Tareas nuevas: sin repetir clave. Primero las que no son subtareas (las reglas comprueban
  // que la padre exista antes de escribir la hija).
  const incoming = backup.tasks.filter((t) => {
    if (existing.tasks.has(t.id)) return false
    const owner = usedKeys.get(String(t.key))
    if (owner && owner !== t.id) {
      summary.skippedKeys.push(String(t.key))
      return false
    }
    return true
  })
  const known = new Set([...existing.tasks, ...incoming.map((t) => t.id)])
  const taskData = (t: Doc) => {
    const rest = strip(t)
    delete rest.comments
    const links = ((rest.links ?? []) as TaskLink[]).filter((l) => known.has(l.taskId))
    const parentId = rest.parentId && known.has(String(rest.parentId)) ? rest.parentId : null
    return { ...rest, links, parentId, createdAt: now, updatedAt: now }
  }
  const parents = incoming.filter((t) => !t.parentId || !known.has(String(t.parentId)))
  const children = incoming.filter((t) => !parents.includes(t))
  await commitAll(
    db,
    parents.map((t) => ({ path: [...base, 'tasks', t.id], data: taskData(t) })),
  )
  await commitAll(
    db,
    children.map((t) => ({ path: [...base, 'tasks', t.id], data: taskData(t) })),
  )
  summary.tasks = incoming.length

  // 3. Comentarios (con la fecha de hoy, que es lo que admiten las reglas) y horas.
  const rest: Write[] = []
  for (const t of incoming)
    for (const c of (t.comments ?? []) as Doc[]) {
      rest.push({
        path: [...base, 'tasks', t.id, 'comments', c.id],
        data: { body: c.body, createdAt: now, editedAt: null },
      })
      summary.comments++
    }
  const importedTasks = new Set(incoming.map((t) => t.id))
  for (const w of backup.worklogs)
    if (
      !existing.worklogs.has(w.id) &&
      (importedTasks.has(String(w.taskId)) || existing.tasks.has(String(w.taskId)))
    ) {
      rest.push({ path: [...base, 'worklogs', w.id], data: strip(w) })
      summary.worklogs++
    }
  await commitAll(db, rest)

  // 4. Contadores de claves: que las tareas nuevas no repitan las importadas.
  await raiseCounters(db, uid, incoming)
  return summary
}

/** Sube el contador de cada proyecto (y el de la bandeja) hasta la clave más alta importada. */
async function raiseCounters(db: Firestore, uid: string, tasks: Doc[]): Promise<void> {
  const maxBy = new Map<string, number>()
  for (const t of tasks) {
    const group = (t.projectId as string | null) ?? '__inbox__'
    maxBy.set(group, Math.max(maxBy.get(group) ?? 0, keyNumber(t.key)))
  }
  const batch = writeBatch(db)
  let changes = 0
  for (const [group, max] of maxBy) {
    const ref =
      group === '__inbox__' ? doc(db, 'users', uid) : doc(db, 'users', uid, 'projects', group)
    const snap = await getDoc(ref)
    if (!snap.exists()) continue
    const field = group === '__inbox__' ? 'inboxCounter' : 'taskCounter'
    if (Number(snap.data()[field] ?? 0) < max) {
      batch.update(ref, { [field]: max })
      changes++
    }
  }
  if (changes) await batch.commit()
}
