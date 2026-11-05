import { computed } from 'vue'
import { useLiveTasks } from './useLiveTasks'
import { subtasksQuery, tasksByIdsQueries } from '@/data/taskQueries'
import { relatedIds, subtaskTotals } from '@/domain/links'
import type { Task } from '@/domain/task'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/stores/auth'

/**
 * Tareas relacionadas con la de la vista (step-16): sus subtareas, su padre y las vinculadas,
 * en vivo. Solo lee esas tareas (por id y por `parentId`), nunca la colección entera.
 * Se vuelve a suscribir cuando cambian los vínculos o la padre.
 */
export function useRelatedTasks(task: () => Task | null) {
  const authStore = useAuthStore()

  const { tasks, loading } = useLiveTasks(() => {
    const current = task()
    const uid = authStore.user?.uid
    if (!current || !uid) return null
    const ids = relatedIds(current).sort()
    return {
      key: `related:${uid}:${current.id}:${ids.join(',')}`,
      queries: [subtasksQuery(db, uid, current.id), ...tasksByIdsQueries(db, uid, ids)],
    }
  })

  const byId = computed(() => new Map(tasks.value.map((t) => [t.id, t])))

  const subtasks = computed(() => {
    const id = task()?.id
    return tasks.value
      .filter((t) => t.parentId === id)
      .sort((a, b) => a.key.localeCompare(b.key, 'es', { numeric: true }))
  })

  const parent = computed(() => {
    const parentId = task()?.parentId
    return parentId ? (byId.value.get(parentId) ?? null) : null
  })

  const totals = computed(() => {
    const current = task()
    return current ? subtaskTotals(current, subtasks.value) : null
  })

  return { byId, subtasks, parent, totals, loading }
}
