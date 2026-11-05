import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { onSnapshot, type Query, type Unsubscribe } from 'firebase/firestore'
import { taskFromData, type Task } from '@/domain/task'

export interface LiveTasksSource {
  /** Identifica el conjunto de consultas: si cambia, se vuelve a suscribir (mes, ámbito…). */
  key: string
  queries: Query[]
}

/**
 * Escucha en vivo un conjunto de consultas de tareas y junta los resultados sin duplicados
 * (step-9). Firestore solo cobra las lecturas de los documentos que cambian y, con la caché
 * persistente, al volver a abrir la app solo trae lo nuevo.
 *
 * Se desuscribe solo al desmontar el componente o al cambiar `key`.
 */
export function useLiveTasks(source: () => LiveTasksSource | null) {
  const byQuery = shallowRef<Map<number, Map<string, Task>>>(new Map())
  const pending = ref(0)
  const error = ref<string | null>(null)
  let unsubscribers: Unsubscribe[] = []

  function stop(): void {
    unsubscribers.forEach((unsubscribe) => unsubscribe())
    unsubscribers = []
  }

  watch(
    () => source()?.key ?? null,
    () => {
      stop()
      const current = source()
      byQuery.value = new Map()
      error.value = null
      pending.value = current?.queries.length ?? 0
      if (!current) return
      current.queries.forEach((q, index) => {
        let first = true
        unsubscribers.push(
          onSnapshot(
            q,
            (snap) => {
              const tasks = new Map<string, Task>()
              // `estimate`: una tarea recién creada muestra la hora local hasta que confirma el servidor.
              snap.docs.forEach((d) =>
                tasks.set(d.id, taskFromData(d.id, d.data({ serverTimestamps: 'estimate' }))),
              )
              const next = new Map(byQuery.value)
              next.set(index, tasks)
              byQuery.value = next
              if (first) {
                first = false
                pending.value--
              }
            },
            (e) => {
              error.value = e.code
              if (first) {
                first = false
                pending.value--
              }
            },
          ),
        )
      })
    },
    { immediate: true },
  )

  onScopeDispose(stop)

  /** Tareas de todas las consultas, sin duplicados. */
  const tasks = computed<Task[]>(() => {
    const merged = new Map<string, Task>()
    for (const tasksOfQuery of byQuery.value.values())
      for (const [id, task] of tasksOfQuery) merged.set(id, task)
    return [...merged.values()]
  })

  const loading = computed(() => pending.value > 0)

  return { tasks, loading, error }
}
