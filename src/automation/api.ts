import { getDocs, type Query } from 'firebase/firestore'
import {
  normalizeDate,
  normalizeEstimate,
  normalizeKey,
  normalizeLinkKind,
  normalizePriority,
  normalizeRecurrence,
  normalizeStatus,
  resolveProject,
  resolveTags,
  summarize,
  type TaskSummary,
} from './normalize'
import { commentsQuery } from '@/data/comments'
import {
  closedSinceQuery,
  countSubtasks,
  openQuery,
  subtasksQuery,
  taskByKeyQuery,
  tasksByIdsQueries,
} from '@/data/taskQueries'
import { templatesQuery } from '@/data/templates'
import { taskWorklogsQuery } from '@/data/worklogs'
import { commentFromData } from '@/domain/comments'
import { todayKey } from '@/domain/dates'
import { formatDuration } from '@/domain/duration'
import { isOverdue } from '@/domain/kanban'
import { checkRelation, isLinkType, searchTasks } from '@/domain/links'
import { isClosedStatus, type TaskStatus } from '@/domain/status'
import { nextTagColor } from '@/domain/tags'
import { taskFromData, type Task, type TaskScope } from '@/domain/task'
import { validateNewTask, type NewTaskInput } from '@/domain/taskCreate'
import { inputFromTemplate, subtaskInputs, templateFromData } from '@/domain/templates'
import { todaySections } from '@/domain/today'
import { parseEntry, worklogFromData } from '@/domain/worklog'
import { db } from '@/lib/firebase'
import { i18n } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { useProjectsStore } from '@/stores/projects'
import { useTagsStore } from '@/stores/tags'
import { useTasksStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'

/**
 * API de automatización (v1.3.0): `window.taskwave`, para que Claude (u otro asistente que
 * maneje el navegador) use TaskWave sin leer la pantalla. Se instala al entrar con una cuenta
 * activa (`AppLayout`) y se quita al salir. Usa los mismos stores y validaciones que la app, así
 * que valen los automatismos (cierre, cronómetro, recurrentes, papelera) y las reglas de Firestore.
 * Solo la pueden llamar scripts de la propia web: la CSP no deja cargar scripts de fuera.
 *
 * Todo es asíncrono, devuelve datos planos y, si algo no vale, lanza un `Error` con el motivo en
 * español. Guía de uso para asistentes: skill `use-taskwave`.
 */

export const AUTOMATION_API_VERSION = 1

export interface TaskFilter {
  /** Clave o nombre del proyecto, o «inbox». Sin indicar: todos. */
  project?: string | null
  /** 'open' (por defecto), 'closed', 'all' o una lista de estados. */
  status?: 'open' | 'closed' | 'all' | string | string[]
  /** Palabras del título o una clave. */
  text?: string
  /** Solo las que tocan este periodo (AAAA-MM-DD, «hoy»…). */
  from?: string
  to?: string
  /** Nombre de un tag. */
  tag?: string
  overdue?: boolean
  limit?: number
}

export interface TaskInput {
  title?: string
  project?: string | null
  startDate?: string | null
  endDate?: string | null
  priority?: string
  estimate?: string | number | null
  description?: string
  tags?: string[]
  parent?: string
  recurrence?: unknown
  template?: string
}

export function createAutomationApi() {
  const authStore = useAuthStore()
  const profileStore = useProfileStore()
  const projectsStore = useProjectsStore()
  const tagsStore = useTagsStore()
  const tasksStore = useTasksStore()
  const timer = useTimerStore()

  // ------------------------------------------------------------------ ayudas
  const uid = () => {
    const id = authStore.user?.uid
    if (!id) throw new Error('No hay sesión iniciada en TaskWave.')
    return id
  }
  const today = () => todayKey()
  const hoursPerDay = () => profileStore.prefs.hoursPerDay
  const baseUrl = () => `${location.origin}${import.meta.env.BASE_URL}`
  const knownKeys = new Map<string, string>()

  const ctx = () => ({
    projectName: (id: string | null) =>
      id ? (projectsStore.byId(id)?.name ?? null) : i18n.global.t('nav.inbox'),
    tagName: (id: string) => tagsStore.byId(id)?.name,
    keyOf: (id: string) => knownKeys.get(id),
    hoursPerDay: hoursPerDay(),
    baseUrl: baseUrl(),
  })
  const remember = (tasks: Task[]) => tasks.forEach((t) => knownKeys.set(t.id, t.key))
  const summaries = (tasks: Task[]): TaskSummary[] => {
    remember(tasks)
    return tasks.map((t) => summarize(t, ctx()))
  }

  async function read(queries: Query[]): Promise<Task[]> {
    const snaps = await Promise.all(queries.map((q) => getDocs(q)))
    const byId = new Map<string, Task>()
    for (const snap of snaps)
      for (const d of snap.docs) byId.set(d.id, taskFromData(d.id, d.data()))
    return [...byId.values()]
  }

  async function findTask(key: unknown): Promise<Task> {
    const normalized = normalizeKey(key)
    const [task] = await read([taskByKeyQuery(db, uid(), normalized)])
    if (!task) throw new Error(`No existe la tarea ${normalized}.`)
    remember([task])
    return task
  }

  /** Ids de tags por nombre, creando los que falten. */
  async function tagIds(names: unknown): Promise<string[]> {
    const { ids, missing } = resolveTags(names, tagsStore.all)
    for (const name of missing)
      ids.push(await tagsStore.create({ name, color: nextTagColor(tagsStore.all) }))
    return ids
  }

  function scopeOf(project: unknown): TaskScope {
    const id = resolveProject(project, projectsStore.all)
    if (id === undefined) return { kind: 'all' }
    return id === null ? { kind: 'inbox' } : { kind: 'project', projectId: id }
  }

  async function waitFor(check: () => boolean, ms = 10_000): Promise<void> {
    const start = Date.now()
    while (!check()) {
      if (Date.now() - start > ms) throw new Error('TaskWave aún no ha cargado tus datos.')
      await new Promise((r) => setTimeout(r, 100))
    }
  }

  // ------------------------------------------------------------------ lectura
  async function ready() {
    uid()
    await waitFor(() => projectsStore.loaded && profileStore.profile !== null)
    return {
      api: AUTOMATION_API_VERSION,
      version: __APP_VERSION__,
      email: authStore.user?.email ?? null,
      today: today(),
      hoursPerDay: hoursPerDay(),
      projects: projects(),
      tags: tags(),
    }
  }

  function projects() {
    return projectsStore.all.map((p) => ({ key: p.key, name: p.name, archived: p.archived }))
  }

  function tags() {
    return tagsStore.all.map((t) => t.name).sort((a, b) => a.localeCompare(b, 'es'))
  }

  async function tasks(filter: TaskFilter = {}): Promise<TaskSummary[]> {
    const scope = scopeOf(filter.project)
    const status = filter.status ?? 'open'
    const wanted: TaskStatus[] | null = Array.isArray(status)
      ? status.map(normalizeStatus)
      : ['open', 'closed', 'all'].includes(String(status))
        ? null
        : [normalizeStatus(status)]
    const needOpen =
      status === 'open' || status === 'all' || wanted?.some((s) => !isClosedStatus(s))
    const needClosed =
      status === 'closed' || status === 'all' || wanted?.some((s) => isClosedStatus(s))
    const queries: Query[] = []
    if (needOpen) queries.push(openQuery(db, uid(), scope))
    if (needClosed) queries.push(closedSinceQuery(db, uid(), scope, 0))
    let list = await read(queries)

    if (wanted) list = list.filter((t) => wanted.includes(t.status))
    const from = normalizeDate(filter.from, today())
    const to = normalizeDate(filter.to, today())
    if (from || to)
      list = list.filter((t) => {
        const start = t.startDate ?? t.endDate
        const end = t.endDate ?? t.startDate
        if (!start || !end) return false
        return (!to || start <= to) && (!from || end >= from)
      })
    if (filter.tag) {
      const { ids } = resolveTags([filter.tag], tagsStore.all)
      if (!ids.length) throw new Error(`No existe el tag «${filter.tag}».`)
      list = list.filter((t) => t.tagIds.includes(ids[0]!))
    }
    if (filter.overdue) list = list.filter((t) => isOverdue(t, today()))
    const max = Math.max(1, Math.min(filter.limit ?? 50, 500))
    list = filter.text
      ? searchTasks(list, filter.text, new Set(), max)
      : list
          .sort(
            (a, b) =>
              (a.endDate ?? a.startDate ?? '9999').localeCompare(
                b.endDate ?? b.startDate ?? '9999',
              ) || a.key.localeCompare(b.key, 'es', { numeric: true }),
          )
          .slice(0, max)
    return summaries(list)
  }

  async function task(key: string) {
    const t = await findTask(key)
    const related = [
      ...new Set([...t.links.map((l) => l.taskId), ...(t.parentId ? [t.parentId] : [])]),
    ]
    const [subs, linked, comments, worklogs] = await Promise.all([
      read([subtasksQuery(db, uid(), t.id)]),
      related.length ? read(tasksByIdsQueries(db, uid(), related)) : Promise.resolve([]),
      getDocs(commentsQuery(db, uid(), t.id, 5)),
      getDocs(taskWorklogsQuery(db, uid(), t.id, 10)),
    ])
    remember([...subs, ...linked])
    const keyOf = (id: string) => knownKeys.get(id) ?? '(borrada)'
    return {
      ...summarize(t, ctx()),
      description: t.description,
      links: t.links.map((l) => ({ type: l.type, task: keyOf(l.taskId) })),
      subtasks: summaries(subs),
      recentComments: comments.docs.map((d) => {
        const c = commentFromData(d.id, d.data())
        return { body: c.body, at: c.createdAtMs ? new Date(c.createdAtMs).toISOString() : null }
      }),
      recentWorklogs: worklogs.docs.map((d) => {
        const w = worklogFromData(d.id, d.data())
        return { date: w.date, time: formatDuration(w.minutes, hoursPerDay()), note: w.note }
      }),
    }
  }

  async function todayView() {
    const list = await read([openQuery(db, uid(), { kind: 'all' })])
    const s = todaySections(list, today())
    return {
      today: today(),
      overdue: summaries(s.overdue),
      dueToday: summaries(s.today),
      inProgress: summaries(s.inProgress),
    }
  }

  async function templates() {
    const snap = await getDocs(templatesQuery(db, uid()))
    return snap.docs.map((d) => {
      const t = templateFromData(d.id, d.data())
      return { name: t.name, title: t.title, subtasks: t.subtasks.length }
    })
  }

  // ------------------------------------------------------------------ escritura
  async function createTask(input: TaskInput) {
    let parent: Task | null = null
    if (input.parent) {
      parent = await findTask(input.parent)
      if (parent.parentId) throw new Error(`${parent.key} es una subtarea: solo hay un nivel.`)
    }
    // Una subtarea sin proyecto indicado va al de su padre.
    const resolved = resolveProject(input.project, projectsStore.all)
    const projectId = resolved === undefined ? (parent?.projectId ?? null) : resolved
    const startDate = normalizeDate(input.startDate, today())
    const endDate = normalizeDate(input.endDate, today())
    const base = {
      title: String(input.title ?? '').trim(),
      projectId,
      startDate,
      endDate,
      priority: input.priority ? normalizePriority(input.priority) : ('medium' as const),
    }
    let payload: NewTaskInput = base
    let template = null
    if (input.template) {
      const snap = await getDocs(templatesQuery(db, uid()))
      const found = snap.docs
        .map((d) => templateFromData(d.id, d.data()))
        .find((t) => t.name.toLowerCase() === String(input.template).toLowerCase())
      if (!found) throw new Error(`No existe la plantilla «${input.template}».`)
      template = found
      payload = inputFromTemplate(found, { ...base, title: base.title || found.title })
    }
    payload = {
      ...payload,
      ...(input.description !== undefined ? { description: String(input.description) } : {}),
      ...(input.estimate !== undefined
        ? { estimateMin: normalizeEstimate(input.estimate, hoursPerDay()) }
        : {}),
      ...(input.tags !== undefined ? { tagIds: await tagIds(input.tags) } : {}),
      ...(input.recurrence !== undefined
        ? { recurrence: normalizeRecurrence(input.recurrence) }
        : {}),
      ...(parent ? { parentId: parent.id } : {}),
    }
    const errors = validateNewTask(payload)
    const first = Object.values(errors)[0]
    if (first) throw new Error(String(i18n.global.t(first)))
    const created = await tasksStore.create(payload)
    if (template)
      for (const sub of subtaskInputs(template, { id: created.id, ...payload }))
        await tasksStore.create(sub)
    return { key: created.key, url: `${baseUrl()}t/${created.key}` }
  }

  async function updateTask(
    key: string,
    changes: TaskInput & { addTags?: string[]; removeTags?: string[] },
  ) {
    const t = await findTask(key)
    const fields: Parameters<typeof tasksStore.updateFields>[1] = {}
    if (changes.title !== undefined) {
      const title = String(changes.title).trim()
      if (!title) throw new Error('El título no puede quedar vacío.')
      fields.title = title
    }
    if (changes.description !== undefined) fields.description = String(changes.description)
    if (changes.priority !== undefined) fields.priority = normalizePriority(changes.priority)
    if (changes.estimate !== undefined)
      fields.estimateMin = normalizeEstimate(changes.estimate, hoursPerDay())
    if (changes.recurrence !== undefined)
      fields.recurrence = normalizeRecurrence(changes.recurrence)
    let tagList = changes.tags !== undefined ? await tagIds(changes.tags) : [...t.tagIds]
    if (changes.addTags)
      for (const id of await tagIds(changes.addTags)) if (!tagList.includes(id)) tagList.push(id)
    if (changes.removeTags) {
      const { ids } = resolveTags(changes.removeTags, tagsStore.all)
      tagList = tagList.filter((id) => !ids.includes(id))
    }
    if (changes.tags !== undefined || changes.addTags || changes.removeTags) {
      if (tagList.length > 20) throw new Error('Una tarea admite como mucho 20 tags.')
      fields.tagIds = tagList
    }
    if (Object.keys(fields).length) await tasksStore.updateFields(t, fields)

    if (changes.startDate !== undefined || changes.endDate !== undefined) {
      const startDate =
        changes.startDate !== undefined ? normalizeDate(changes.startDate, today()) : t.startDate
      const endDate =
        changes.endDate !== undefined ? normalizeDate(changes.endDate, today()) : t.endDate
      if (endDate && !startDate) throw new Error('No puede tener fecha fin sin fecha de inicio.')
      if (startDate && endDate && endDate < startDate)
        throw new Error('La fecha fin no puede ser anterior al inicio.')
      await tasksStore.setDates(t, { startDate, endDate: endDate === startDate ? null : endDate })
    }
    if (changes.project !== undefined) {
      const newKey = await move(t.key, changes.project)
      return task(newKey.key)
    }
    return task(t.key)
  }

  async function setStatus(key: string, status: string) {
    const t = await findTask(key)
    const next = normalizeStatus(status)
    // Al cerrar con el cronómetro en marcha, se para sin preguntar (lo ha pedido el usuario).
    if (isClosedStatus(next) && timer.isRunningOn(t.id)) await timer.confirmStop()
    const nextOccurrence = await tasksStore.setStatus(t, next)
    const after = await findTask(t.key)
    return { ...summarize(after, ctx()), nextOccurrence }
  }

  async function move(key: string, project: string | null) {
    const t = await findTask(key)
    const projectId = resolveProject(project, projectsStore.all) ?? null
    if (projectId === t.projectId) return { key: t.key, url: `${baseUrl()}t/${t.key}` }
    const newKey = (await tasksStore.moveToProject(t, projectId)) ?? t.key
    return { key: newKey, url: `${baseUrl()}t/${newKey}` }
  }

  async function logHours(
    key: string,
    entry: { duration: string | number; date?: string; start?: string; note?: string },
  ) {
    const t = await findTask(key)
    const duration =
      typeof entry.duration === 'number' ? `${entry.duration}m` : String(entry.duration ?? '')
    const { errors, entry: parsed } = parseEntry(
      {
        date: normalizeDate(entry.date ?? 'hoy', today()) ?? today(),
        duration,
        startTime: entry.start ?? '09:00',
        note: entry.note ?? '',
      },
      today(),
      hoursPerDay(),
    )
    const first = Object.values(errors)[0]
    if (first || !parsed) throw new Error(String(i18n.global.t(first ?? 'worklog.errors.duration')))
    await tasksStore.logHours(t, parsed)
    const after = await findTask(t.key)
    return {
      key: t.key,
      logged: formatDuration(parsed.minutes, hoursPerDay()),
      date: parsed.date,
      spent: summarize(after, ctx()).spent,
    }
  }

  async function comment(key: string, body: string) {
    const t = await findTask(key)
    const text = String(body ?? '').trim()
    if (!text) throw new Error('El comentario está vacío.')
    if (text.length > 10000) throw new Error('El comentario pasa de 10 000 caracteres.')
    await tasksStore.comment(t, text)
    return { key: t.key, url: `${baseUrl()}t/${t.key}` }
  }

  async function link(key: string, type: string, otherKey: string) {
    const t = await findTask(key)
    const other = await findTask(otherKey)
    const kind = normalizeLinkKind(type)
    const [taskSubs, otherSubs] = await Promise.all([
      countSubtasks(db, uid(), t.id),
      kind === 'child' ? countSubtasks(db, uid(), other.id) : Promise.resolve(0),
    ])
    const problem = checkRelation(t, other, kind, taskSubs > 0, otherSubs > 0)
    if (problem)
      throw new Error(
        String(i18n.global.t(`relations.errors.${problem}`, { key: other.key, max: 50 })),
      )
    if (isLinkType(kind)) await tasksStore.link(t, { type: kind, taskId: other.id })
    else if (kind === 'parent') await tasksStore.setParent(t.id, other.id)
    else await tasksStore.setParent(other.id, t.id)
    return { key: t.key, type: kind, other: other.key }
  }

  async function duplicate(key: string) {
    const t = await findTask(key)
    const created = await tasksStore.duplicate(t)
    return { key: created.key, url: `${baseUrl()}t/${created.key}` }
  }

  async function remove(key: string) {
    const t = await findTask(key)
    const summary = await tasksStore.remove(t)
    return { key: t.key, trashed: summary.trashed }
  }

  async function startTimer(key: string, options: { switch?: boolean } = {}) {
    const t = await findTask(key)
    if (isClosedStatus(t.status))
      throw new Error(`${t.key} está cerrada: reábrela antes de cronometrarla.`)
    if (timer.isRunningOn(t.id)) return { running: t.key, alreadyRunning: true }
    if (timer.active && !options.switch)
      throw new Error(
        `El cronómetro está en ${timer.task?.key ?? 'otra tarea'}. Pide confirmación y llama con { switch: true } para pararlo y empezar en ${t.key}.`,
      )
    await timer.requestStart(t)
    if (timer.pending?.kind === 'switch') await timer.confirmSwitch()
    await waitFor(() => timer.isRunningOn(t.id), 5000)
    return { running: t.key, alreadyRunning: false }
  }

  async function stopTimer() {
    if (!timer.active) return { stopped: null }
    const key = timer.task?.key ?? null
    const ok = await timer.confirmStop()
    if (!ok) throw new Error('No se ha podido parar el cronómetro.')
    return { stopped: key }
  }

  function timerState() {
    return timer.active
      ? { running: timer.task?.key ?? null, clock: timer.clock }
      : { running: null }
  }

  function help() {
    return {
      read: {
        'ready()': 'Espera a que carguen los datos; devuelve versión, hoy, proyectos y tags.',
        'projects()': 'Proyectos: clave, nombre y si está archivado.',
        'tags()': 'Nombres de los tags.',
        'templates()': 'Plantillas: nombre, título y número de subtareas.',
        'tasks({ project, status, text, from, to, tag, overdue, limit })':
          "Buscar. status: 'open' (por defecto), 'closed', 'all', un estado o una lista.",
        'task(key)': 'Detalle con descripción, vínculos, subtareas, comentarios y horas recientes.',
        'today()': 'Atrasadas, las de hoy y en curso.',
        'timerState()': 'Tarea con el cronómetro en marcha.',
      },
      write: {
        'createTask({ title, project, startDate, endDate, priority, estimate, description, tags, parent, recurrence, template })':
          'Crea; devuelve { key, url }. Los tags que no existen se crean.',
        'updateTask(key, { title, description, priority, estimate, startDate, endDate, tags, addTags, removeTags, recurrence, project })':
          'Edita y devuelve el detalle.',
        'setStatus(key, status)': 'pendiente, en curso, paralizada, realizada, descartada o ko.',
        'move(key, project)': 'Cambia de proyecto (cambia la clave); devuelve la nueva.',
        'logHours(key, { duration, date, start, note })':
          'Apunta horas (por defecto hoy a las 09:00).',
        'comment(key, text)': 'Comentario en markdown.',
        'link(key, type, otherKey)':
          'blocks, blocked_by, causes, caused_by, relates, parent o child.',
        'duplicate(key)': 'Duplica.',
        'remove(key)': 'Manda a la papelera (30 días).',
        'startTimer(key, { switch })':
          'Inicia el cronómetro; switch para cambiar desde otra tarea.',
        'stopTimer()': 'Para el cronómetro y registra las horas.',
      },
    }
  }

  return {
    ready,
    help,
    projects: async () => projects(),
    tags: async () => tags(),
    templates,
    tasks,
    task,
    today: todayView,
    timerState: async () => timerState(),
    createTask,
    updateTask,
    setStatus,
    move,
    logHours,
    comment,
    link,
    duplicate,
    remove,
    startTimer,
    stopTimer,
  }
}

export type AutomationApi = ReturnType<typeof createAutomationApi>
