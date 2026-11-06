import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { commentsQuery } from '@/data/comments'
import { commentFromData, type Comment } from '@/domain/comments'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/stores/auth'

const PAGE = 20

/**
 * Comentarios de una tarea en vivo (step-18), de más reciente a más antiguo, de 20 en 20
 * («Ver más» amplía el límite). Solo se leen los que se muestran.
 */
export function useTaskComments(taskId: () => string | null) {
  const authStore = useAuthStore()
  const max = ref(PAGE)
  const comments = shallowRef<Comment[]>([])
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
        comments.value = []
        return
      }
      loading.value = true
      stop = onSnapshot(
        commentsQuery(db, uid, id, limit),
        (snap) => {
          // `estimate`: un comentario recién escrito muestra la hora local hasta que confirma el servidor.
          comments.value = snap.docs.map((d) =>
            commentFromData(d.id, d.data({ serverTimestamps: 'estimate' })),
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

  const hasMore = computed(() => comments.value.length >= max.value)

  function more(): void {
    max.value += PAGE
  }

  return { comments, loading, error, hasMore, more }
}
