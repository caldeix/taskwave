import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TaskStatus } from '@/domain/status'
import type { Task } from '@/domain/task'
import { useTasksStore } from '@/stores/tasks'
import { useToastsStore } from '@/stores/toasts'

/**
 * Cambiar el estado de una tarea desde una lista (v1.1.0), con aviso al guardar. Si se cancela el
 * aviso del cronómetro al cerrar, no se trata como un error.
 */
export function useTaskStatusChange() {
  const { t } = useI18n()
  const tasksStore = useTasksStore()
  const toasts = useToastsStore()
  /** Id de la tarea que se está guardando. */
  const saving = ref<string | null>(null)

  async function changeStatus(task: Task, status: TaskStatus): Promise<void> {
    if (saving.value) return
    saving.value = task.id
    try {
      await tasksStore.setStatus(task, status)
      toasts.show(t('relations.statusChanged', { key: task.key, status: t(`status.${status}`) }))
    } catch (error) {
      if (!(error instanceof Error && error.message === 'timer-stop-failed'))
        toasts.show(t('taskView.saveFailed'), 'error')
    } finally {
      saving.value = null
    }
  }

  return { saving, changeStatus }
}
