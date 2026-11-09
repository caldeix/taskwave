import type { NewTaskInput } from './taskCreate'
import { PRIORITIES, type Priority, type Task } from './task'

/**
 * Plantillas de tarea (plan TASKWAVE-02, idea 9, D-10, CA-9b) en `users/{uid}/templates`: lo que
 * se repite al crear un tipo de tarea (título, descripción, prioridad, estimado, tags y los
 * títulos de sus subtareas). No guardan proyecto ni fechas: se eligen al crear.
 */
export interface TaskTemplate {
  id: string
  name: string
  title: string
  description: string
  priority: Priority
  estimateMin: number | null
  tagIds: string[]
  subtasks: string[]
}

export const MAX_TEMPLATE_NAME = 80
export const MAX_TEMPLATE_SUBTASKS = 30

/** Datos de la plantilla a partir de una tarea y los títulos de sus subtareas. */
export function templateFromTask(
  task: Pick<Task, 'title' | 'description' | 'priority' | 'estimateMin' | 'tagIds'>,
  name: string,
  subtaskTitles: string[],
): Omit<TaskTemplate, 'id'> {
  return {
    name: name.trim().slice(0, MAX_TEMPLATE_NAME) || task.title.slice(0, MAX_TEMPLATE_NAME),
    title: task.title,
    description: task.description,
    priority: task.priority,
    estimateMin: task.estimateMin,
    tagIds: [...task.tagIds],
    subtasks: subtaskTitles
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_TEMPLATE_SUBTASKS),
  }
}

export function templateFromData(id: string, data: Record<string, unknown>): TaskTemplate {
  const priority = PRIORITIES.includes(data.priority as Priority)
    ? (data.priority as Priority)
    : 'medium'
  return {
    id,
    name: String(data.name ?? ''),
    title: String(data.title ?? ''),
    description: String(data.description ?? ''),
    priority,
    estimateMin: typeof data.estimateMin === 'number' ? data.estimateMin : null,
    tagIds: Array.isArray(data.tagIds) ? (data.tagIds as string[]) : [],
    subtasks: Array.isArray(data.subtasks) ? (data.subtasks as string[]) : [],
  }
}

/** Alta de una tarea desde la plantilla, con el título, proyecto y fechas del formulario. */
export function inputFromTemplate(
  template: TaskTemplate,
  form: Pick<NewTaskInput, 'title' | 'projectId' | 'startDate' | 'endDate' | 'priority'>,
): NewTaskInput {
  return {
    ...form,
    description: template.description,
    estimateMin: template.estimateMin,
    tagIds: [...template.tagIds],
  }
}

/** Altas de las subtareas de la plantilla, debajo de la tarea creada. */
export function subtaskInputs(
  template: TaskTemplate,
  parent: { id: string; projectId: string | null; priority: Priority },
): NewTaskInput[] {
  return template.subtasks.map((title) => ({
    title,
    projectId: parent.projectId,
    startDate: null,
    endDate: null,
    priority: parent.priority,
    parentId: parent.id,
  }))
}
