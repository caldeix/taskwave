import { defineStore } from 'pinia'
import { createTask, deleteTask, type DeleteSummary } from '@/data/taskWrites'
import type { Task } from '@/domain/task'
import type { NewTaskInput } from '@/domain/taskCreate'
import { db } from '@/lib/firebase'
import { useAuthStore } from './auth'

/**
 * Acciones sobre tareas del usuario con sesión (step-10). Las lecturas van por `useLiveTasks`;
 * aquí solo están las escrituras, con el uid ya resuelto.
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

  return { create, remove }
})
