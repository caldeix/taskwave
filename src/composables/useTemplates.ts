import { computed, onScopeDispose, ref, watch } from 'vue'
import { onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { deleteTemplate, saveTemplate, templatesQuery } from '@/data/templates'
import { templateFromData, type TaskTemplate } from '@/domain/templates'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/stores/auth'

/**
 * Plantillas del usuario en vivo (v1.1.0, D-10). Solo se escuchan mientras se usa el componente
 * (formulario de nueva tarea, Ajustes); son pocas y cortas.
 */
export function useTemplates(enabled: () => boolean = () => true) {
  const authStore = useAuthStore()
  const uid = computed(() => authStore.user?.uid ?? null)
  const templates = ref<TaskTemplate[]>([])
  const loading = ref(true)
  let stop: Unsubscribe | null = null

  watch(
    () => (enabled() ? uid.value : null),
    (current) => {
      stop?.()
      stop = null
      if (!current) return
      loading.value = true
      stop = onSnapshot(
        templatesQuery(db, current),
        (snap) => {
          templates.value = snap.docs.map((d) => templateFromData(d.id, d.data()))
          loading.value = false
        },
        () => (loading.value = false),
      )
    },
    { immediate: true },
  )
  onScopeDispose(() => stop?.())

  function requireUid(): string {
    if (!uid.value) throw new Error('not-signed-in')
    return uid.value
  }

  return {
    templates,
    loading,
    save: (template: Omit<TaskTemplate, 'id'>) => saveTemplate(db, requireUid(), template),
    remove: (id: string) => deleteTemplate(db, requireUid(), id),
  }
}
