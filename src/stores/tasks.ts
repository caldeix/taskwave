import { defineStore } from 'pinia'
import {
  createTask,
  deleteTask,
  updateTaskDates,
  updateTaskStatus,
  type DeleteSummary,
} from '@/data/taskWrites'
import { todayKey } from '@/domain/dates'
import { statusChangePatch } from '@/domain/kanban'
import type { TaskStatus } from '@/domain/status'
import type { Task } from '@/domain/task'
import type { NewTaskInput } from '@/domain/taskCreate'
import { db } from '@/lib/firebase'
import { useAuthStore } from './auth'

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

  function remove(task: Task): Promise<DeleteSummary> {
    return deleteTask(db, requireUid(), task)
  }

  /** Mueve una tarea de fecha. Con la caché, el calendario se actualiza al instante. */
  function setDates(
    task: Task,
    dates: { startDate: string | null; endDate: string | null },
  ): Promise<void> {
    return updateTaskDates(db, requireUid(), task.id, dates)
  }

  /** Cambia el estado con los automatismos de D-17 (no hace nada si no cambia). */
  async function setStatus(task: Task, status: TaskStatus): Promise<void> {
    if (task.status === status) return
    await updateTaskStatus(db, requireUid(), task.id, statusChangePatch(task, status, todayKey()))
  }

  return { create, remove, setDates, setStatus }
})
