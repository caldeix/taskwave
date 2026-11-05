import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  moveProject,
  nextOrder,
  sortProjects,
  type Project,
  type ProjectInput,
} from '@/domain/projects'
import { useAuthStore } from './auth'
import { useProfileStore } from './profile'

/**
 * Proyectos del usuario (`users/{uid}/projects`, step-8).
 * Se escuchan en vivo mientras la cuenta está activa; son pocos documentos, así que
 * la escucha cuesta muy pocas lecturas.
 */
export const useProjectsStore = defineStore('projects', () => {
  const authStore = useAuthStore()
  const profileStore = useProfileStore()

  const all = ref<Project[]>([])
  const loaded = ref(false)
  let stop: Unsubscribe | null = null

  const uid = computed(() => authStore.user?.uid ?? null)
  const active = computed(() => sortProjects(all.value.filter((p) => !p.archived)))
  const archived = computed(() => sortProjects(all.value.filter((p) => p.archived)))
  const keys = computed(() => all.value.map((p) => p.key))

  function projectsRef(userId: string) {
    return collection(db, 'users', userId, 'projects')
  }

  watch(
    () => (profileStore.status === 'active' ? uid.value : null),
    (userId) => {
      stop?.()
      stop = null
      all.value = []
      loaded.value = false
      if (!userId) return
      stop = onSnapshot(
        projectsRef(userId),
        (snap) => {
          all.value = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Project, 'id'>) }))
          loaded.value = true
        },
        // Sin permiso (p. ej. la cuenta se acaba de bloquear) o sin conexión: lista vacía.
        () => {
          all.value = []
          loaded.value = true
        },
      )
    },
    { immediate: true },
  )

  function byKey(key: string): Project | undefined {
    return all.value.find((p) => p.key === key)
  }

  function byId(id: string): Project | undefined {
    return all.value.find((p) => p.id === id)
  }

  function requireUid(): string {
    if (!uid.value) throw new Error('Sin sesión')
    return uid.value
  }

  async function create(input: ProjectInput): Promise<string> {
    const ref = await addDoc(projectsRef(requireUid()), {
      name: input.name.trim(),
      key: input.key,
      color: input.color,
      icon: input.icon,
      order: nextOrder(all.value),
      archived: false,
      taskCounter: 0,
      createdAt: serverTimestamp(),
    })
    return ref.id
  }

  /** Edita nombre, color e icono. La clave no cambia (es el prefijo de las tareas, D-12). */
  async function update(id: string, input: Omit<ProjectInput, 'key'>): Promise<void> {
    await updateDoc(doc(projectsRef(requireUid()), id), {
      name: input.name.trim(),
      color: input.color,
      icon: input.icon,
    })
  }

  async function move(id: string, direction: 'up' | 'down'): Promise<void> {
    const changes = moveProject(all.value, id, direction)
    if (changes.length === 0) return
    const batch = writeBatch(db)
    for (const change of changes)
      batch.update(doc(projectsRef(requireUid()), change.id), { order: change.order })
    await batch.commit()
  }

  /** Archivar oculta el proyecto del menú; al desarchivar vuelve al final de la lista (D-14). */
  async function setArchived(id: string, value: boolean): Promise<void> {
    const patch: Record<string, unknown> = { archived: value }
    if (!value) patch.order = nextOrder(all.value.filter((p) => !p.archived))
    await updateDoc(doc(projectsRef(requireUid()), id), patch)
  }

  /** ¿Tiene tareas? Basta con encontrar una (1 lectura como mucho). */
  async function hasTasks(id: string): Promise<boolean> {
    const snap = await getDocs(
      query(collection(db, 'users', requireUid(), 'tasks'), where('projectId', '==', id), limit(1)),
    )
    return !snap.empty
  }

  /** Borra un proyecto solo si está vacío (D-14). Devuelve `false` si tiene tareas. */
  async function remove(id: string): Promise<boolean> {
    if (await hasTasks(id)) return false
    await deleteDoc(doc(projectsRef(requireUid()), id))
    return true
  }

  return {
    all,
    active,
    archived,
    keys,
    loaded,
    byKey,
    byId,
    create,
    update,
    move,
    setArchived,
    remove,
  }
})
