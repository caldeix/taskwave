import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import { getDocs } from 'firebase/firestore'
import { useLiveTasks } from './useLiveTasks'
import { openQuery, taskByKeyQuery } from '@/data/taskQueries'
import { parseTaskKey, searchTasks } from '@/domain/links'
import { taskFromData, type Task } from '@/domain/task'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/stores/auth'

/**
 * Buscador de tareas por clave o palabras del título (steps 16 y 24): busca entre las abiertas
 * (una consulta acotada, en vivo mientras `enabled`) y, si se escribe una clave exacta
 * (`EST-12`), la busca también entre las cerradas.
 */
export function useTaskSearch(
  text: Ref<string>,
  options: { enabled?: () => boolean; exclude?: () => string[]; max?: number } = {},
) {
  const authStore = useAuthStore()
  const uid = computed(() => authStore.user?.uid ?? null)
  const enabled = () => options.enabled?.() ?? true

  const { tasks: openTasks } = useLiveTasks(() =>
    uid.value && enabled()
      ? { key: `search:${uid.value}`, queries: [openQuery(db, uid.value, { kind: 'all' })] }
      : null,
  )

  /** Tarea encontrada por su clave exacta (puede estar cerrada). */
  const byKey = ref<Task | null>(null)
  const searchingKey = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  watch(text, (value) => {
    clearTimeout(timer)
    byKey.value = null
    const key = parseTaskKey(value)
    searchingKey.value = Boolean(key && uid.value)
    if (!key || !uid.value) return
    timer = setTimeout(async () => {
      try {
        const snap = await getDocs(taskByKeyQuery(db, uid.value!, key))
        const d = snap.docs[0]
        if (d && parseTaskKey(text.value) === key) byKey.value = taskFromData(d.id, d.data())
      } catch {
        // Sin conexión: se busca solo en las abiertas.
      } finally {
        if (parseTaskKey(text.value) === key) searchingKey.value = false
      }
    }, 250)
  })
  onScopeDispose(() => clearTimeout(timer))

  const results = computed(() => {
    const pool = byKey.value ? [byKey.value, ...openTasks.value] : openTasks.value
    const unique = [...new Map(pool.map((p) => [p.id, p])).values()]
    return searchTasks(unique, text.value, new Set(options.exclude?.() ?? []), options.max)
  })

  return { results, searchingKey }
}
