import { reactive, watch, type Ref } from 'vue'
import { getDocs } from 'firebase/firestore'
import { tasksByKeysQueries } from '@/data/taskQueries'
import type { TaskStatus } from '@/domain/status'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/stores/auth'

/**
 * Estado de las tareas enlazadas por su clave en el markdown (v1.1.0, D-3, R-4): solo se leen las
 * claves que aparecen y que no se conocen o se leyeron hace más de un minuto. La caché es de toda
 * la app (`null` = no existe).
 */
export interface KeyInfo {
  status: TaskStatus
  title: string
}
const TTL_MS = 60_000
const cache = reactive(new Map<string, KeyInfo | null>())
const readAt = new Map<string, number>()
const fresh = (k: string) => cache.has(k) && Date.now() - (readAt.get(k) ?? 0) < TTL_MS
const pending = new Set<string>()

export function useTaskKeyStatuses(keys: Ref<string[]>) {
  const authStore = useAuthStore()

  watch(
    keys,
    async (list) => {
      const uid = authStore.user?.uid
      const missing = list.filter((k) => !fresh(k) && !pending.has(k))
      if (!uid || !missing.length) return
      missing.forEach((k) => pending.add(k))
      try {
        const snaps = await Promise.all(tasksByKeysQueries(db, uid, missing).map((q) => getDocs(q)))
        const found = new Set<string>()
        for (const snap of snaps)
          for (const d of snap.docs) {
            const data = d.data()
            found.add(String(data.key))
            cache.set(String(data.key), {
              status: data.status as TaskStatus,
              title: String(data.title ?? ''),
            })
          }
        missing.filter((k) => !found.has(k)).forEach((k) => cache.set(k, null))
        missing.forEach((k) => readAt.set(k, Date.now()))
      } catch {
        // Sin conexión: las claves se ven como enlaces sin estado.
      } finally {
        missing.forEach((k) => pending.delete(k))
      }
    },
    { immediate: true },
  )

  return cache
}
