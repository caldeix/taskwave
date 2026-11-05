import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ProjectColor } from '@/domain/projects'
import { useAuthStore } from './auth'
import { useProfileStore } from './profile'

export interface Tag {
  id: string
  name: string
  color: ProjectColor
}

/**
 * Catálogo de tags del usuario (`users/{uid}/tags`, D-40). De momento solo lectura, para los
 * filtros (step-13); crear, renombrar y borrar tags llega en el step-17.
 */
export const useTagsStore = defineStore('tags', () => {
  const authStore = useAuthStore()
  const profileStore = useProfileStore()

  const all = ref<Tag[]>([])
  let stop: Unsubscribe | null = null

  watch(
    () => (profileStore.status === 'active' ? (authStore.user?.uid ?? null) : null),
    (uid) => {
      stop?.()
      stop = null
      all.value = []
      if (!uid) return
      stop = onSnapshot(
        collection(db, 'users', uid, 'tags'),
        (snap) => {
          all.value = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Tag, 'id'>) }))
        },
        () => (all.value = []),
      )
    },
    { immediate: true },
  )

  const sorted = computed(() => [...all.value].sort((a, b) => a.name.localeCompare(b.name, 'es')))

  function byId(id: string): Tag | undefined {
    return all.value.find((t) => t.id === id)
  }

  return { all, sorted, byId }
})
