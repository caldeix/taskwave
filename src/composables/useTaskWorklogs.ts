import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { taskWorklogsQuery } from '@/data/worklogs'
import { worklogFromData, type Worklog } from '@/domain/worklog'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/stores/auth'

const PAGE = 100

/**
 * Registro de horas de una tarea en vivo (step-20), del día más reciente al más antiguo, de
 * 100 en 100 («Ver más» amplía el límite).
 */
export function useTaskWorklogs(taskId: () => string | null) {
  const authStore = useAuthStore()
  const max = ref(PAGE)
  const logs = shallowRef<Worklog[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  let stop: Unsubscribe | null = null

  watch(taskId, () => (max.value = PAGE))

  watch(
    () => [authStore.user?.uid ?? null, taskId(), max.value] as const,
    ([uid, id, limit]) => {
      stop?.()
      stop = null
      error.value = null
      if (!uid || !id) {
        logs.value = []
        return
      }
      loading.value = true
      stop = onSnapshot(
        taskWorklogsQuery(db, uid, id, limit),
        (snap) => {
          logs.value = snap.docs.map((d) => worklogFromData(d.id, d.data()))
          loading.value = false
        },
        (e) => {
          error.value = e.code
          loading.value = false
        },
      )
    },
    { immediate: true },
  )

  onScopeDispose(() => stop?.())

  const hasMore = computed(() => logs.value.length >= max.value)

  function more(): void {
    max.value += PAGE
  }

  return { logs, loading, error, hasMore, more }
}
