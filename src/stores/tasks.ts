import { defineStore } from 'pinia'
import {
  createTask,
  deleteTask,
  changeRelation,
  linkTasks,
  updateBacklog,
  moveTaskToProject,
  setTaskParent,
  unlinkTasks,
  updateTaskDates,
  updateTaskFields,
  updateTaskStatus,
  type DeleteSummary,
  type EditableTaskFields,
} from '@/data/taskWrites'
import { addComment, deleteComment, editComment } from '@/data/comments'
import { addWorklog, deleteWorklog, updateWorklog } from '@/data/worklogs'
import { todayKey } from '@/domain/dates'
import { statusChangePatch } from '@/domain/kanban'
import { isClosedStatus, type TaskStatus } from '@/domain/status'
import type { RelationKind } from '@/domain/links'
import type { Task, TaskLink } from '@/domain/task'
import { nextOccurrenceInput } from '@/domain/recurrence'
import { duplicateInput, type NewTaskInput } from '@/domain/taskCreate'
import type { Entry } from '@/domain/worklog'
import { db } from '@/lib/firebase'
import { useAuthStore } from './auth'
import { useTimerStore } from './timer'
import { useToastsStore } from './toasts'
import { i18n } from '@/i18n'

/**
 * Acciones sobre tareas del usuario con sesión (steps 10 a 12). Las lecturas van por
 * `useLiveTasks`; aquí solo están las escrituras, con el uid ya resuelto.
 */
export const useTasksStore = defineStore('tasks', () => {
  const authStore = useAuthStore()

  function requireUid(): string {
    const uid = authStore.user?.uid
    if (!uid) throw new Error('Sin sesión')
    return uid
  }

  function create(input: NewTaskInput): Promise<{ id: string; key: string }> {
    return createTask(db, requireUid(), input)
  }

  /** Duplica una tarea (step-24, D-52); devuelve la nueva con su clave. */
  function duplicate(task: Task): Promise<{ id: string; key: string }> {
    return create(duplicateInput(task))
  }

  function remove(task: Task): Promise<DeleteSummary> {
    return deleteTask(db, requireUid(), task)
  }

  /** Mueve una tarea de fecha. Con la caché, el calendario se actualiza al instante. */
  function setDates(
    task: Task,
    dates: { startDate: string | null; endDate: string | null },
  ): Promise<void> {
    return updateTaskDates(db, requireUid(), task.id, dates, task)
  }

  /**
   * Cambia el estado con los automatismos de D-17 (no hace nada si no cambia). Si era recurrente
   * y pasa a Realizada, devuelve la clave de la siguiente (v1.1.0); si no, `null`.
   */
  async function setStatus(task: Task, status: TaskStatus): Promise<string | null> {
    if (task.status === status) return null
    // Al cerrar una tarea con el cronómetro en marcha, se para y se registran sus horas (D-17).
    const timer = useTimerStore()
    if (isClosedStatus(status) && timer.isRunningOn(task.id) && !(await timer.confirmStop()))
      throw new Error('timer-stop-failed')
    await updateTaskStatus(
      db,
      requireUid(),
      task.id,
      statusChangePatch(task, status, todayKey()),
      task,
    )
    // Recurrente (v1.1.0, D-9): al terminarla se crea la siguiente, que se queda la recurrencia.
    if (status === 'done' && task.recurrence && !isClosedStatus(task.status)) {
      const next = nextOccurrenceInput(task, todayKey())
      if (next) {
        const created = await create(next)
        await updateTaskFields(db, requireUid(), task.id, { recurrence: null })
        useToastsStore().show(i18n.global.t('recurrence.created', { key: created.key }))
        return created.key
      }
    }
    return null
  }

  /** Autoguardado de campos sueltos desde la vista de tarea (D-46). */
  function updateFields(task: Task, fields: EditableTaskFields): Promise<void> {
    return updateTaskFields(db, requireUid(), task.id, fields, task)
  }

  /** Mueve la tarea a otro proyecto (o a la bandeja); devuelve su nueva clave (D-12). */
  function moveToProject(task: Task, projectId: string | null): Promise<string | null> {
    return moveTaskToProject(db, requireUid(), task, projectId)
  }

  /** Vincula dos tareas; el vínculo inverso se guarda en la otra (D-41). */
  function link(task: Task, link: TaskLink): Promise<void> {
    return linkTasks(db, requireUid(), task.id, link)
  }

  function unlink(task: Task, link: TaskLink): Promise<void> {
    return unlinkTasks(db, requireUid(), task.id, link)
  }

  /** Orden y semana planificada del backlog, en un lote (v1.1.0). */
  function saveBacklog(
    patches: { id: string; rank?: number | null; plannedWeek?: string | null }[],
  ): Promise<void> {
    return updateBacklog(db, requireUid(), patches)
  }

  /** Cambia el tipo de la relación de `task` con `otherId` (v1.0.2). */
  function changeRelationKind(
    task: Task,
    otherId: string,
    from: RelationKind,
    to: RelationKind,
  ): Promise<void> {
    return changeRelation(db, requireUid(), task.id, otherId, from, to)
  }

  /** Hace de `taskId` una subtarea de `parentId`, o la suelta con `null`. */
  function setParent(taskId: string, parentId: string | null): Promise<void> {
    return setTaskParent(db, requireUid(), taskId, parentId)
  }

  // ---- Comentarios (step-18) ----
  function comment(task: Task, body: string): Promise<string> {
    return addComment(db, requireUid(), task.id, body)
  }

  function editCommentBody(task: Task, commentId: string, body: string): Promise<void> {
    return editComment(db, requireUid(), task.id, commentId, body)
  }

  function removeComment(task: Task, commentId: string): Promise<void> {
    return deleteComment(db, requireUid(), task.id, commentId)
  }

  // ---- Registro de horas (step-20); cada cambio ajusta el total de la tarea ----
  function logHours(task: Task, entry: Entry): Promise<string> {
    return addWorklog(db, requireUid(), task.id, entry)
  }

  function editHours(worklogId: string, entry: Entry): Promise<void> {
    return updateWorklog(db, requireUid(), worklogId, entry)
  }

  function removeHours(worklogId: string): Promise<void> {
    return deleteWorklog(db, requireUid(), worklogId)
  }

  return {
    create,
    duplicate,
    remove,
    setDates,
    setStatus,
    updateFields,
    moveToProject,
    link,
    unlink,
    setParent,
    changeRelationKind,
    saveBacklog,
    comment,
    editCommentBody,
    removeComment,
    logHours,
    editHours,
    removeHours,
  }
})
