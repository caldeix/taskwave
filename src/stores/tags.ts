import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { countTagTasks, createTag, deleteTag, updateTag } from '@/data/tagWrites'
import type { ProjectColor } from '@/domain/projects'
import { sortTags, type Tag } from '@/domain/tags'
import { useAuthStore } from './auth'
import { useFiltersStore } from './filters'
import { useProfileStore } from './profile'

export type { Tag }

/**
 * Catálogo de tags del usuario (`users/{uid}/tags`, D-40): se escucha en vivo mientras la cuenta
 * está activa (filtros, selector y tarjetas) y aquí están sus escrituras (step-17).
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

  const sorted = computed(() => sortTags(all.value))

  function byId(id: string): Tag | undefined {
    return all.value.find((t) => t.id === id)
  }

  function requireUid(): string {
    const uid = authStore.user?.uid
    if (!uid) throw new Error('Sin sesión')
    return uid
  }

  function create(tag: { name: string; color: ProjectColor }): Promise<string> {
    return createTag(db, requireUid(), tag)
  }

  function update(id: string, changes: Partial<{ name: string; color: ProjectColor }>) {
    return updateTag(db, requireUid(), id, changes)
  }

  function countTasks(id: string): Promise<number> {
    return countTagTasks(db, requireUid(), id)
  }

  /** Borra el tag de sus tareas y del catálogo, y lo quita también de los filtros guardados. */
  async function remove(id: string): Promise<number> {
    const count = await deleteTag(db, requireUid(), id)
    const filtersStore = useFiltersStore()
    if (filtersStore.filters.tagIds.includes(id))
      filtersStore.update({ tagIds: filtersStore.filters.tagIds.filter((t) => t !== id) })
    return count
  }

  return { all, sorted, byId, create, update, countTasks, remove }
})
