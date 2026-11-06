import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { activityQuery } from '@/data/activity'
import { activityFromData, type ActivityEntry } from '@/domain/activity'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/stores/auth'

const PAGE = 50

/** Actividad de una tarea en vivo (step-22), de lo más reciente a lo más antiguo, de 50 en 50. */
export function useTaskActivity(taskId: () => string | null) {
  const authStore = useAuthStore()
  const max = ref(PAGE)
  const entries = shallowRef<ActivityEntry[]>([])
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
        entries.value = []
        return
      }
      loading.value = true
      stop = onSnapshot(
        activityQuery(db, uid, id, limit),
        (snap) => {
          entries.value = snap.docs.map((d) =>
            activityFromData(d.id, d.data({ serverTimestamps: 'estimate' })),
          )
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

  const hasMore = computed(() => entries.value.length >= max.value)

  function more(): void {
    max.value += PAGE
  }

  return { entries, loading, error, hasMore, more }
}
