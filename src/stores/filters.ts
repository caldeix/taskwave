import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  normalizeFilters,
  type TaskFilters,
} from '@/domain/filters'
import { useProfileStore } from './profile'

/** Espera antes de guardar, para juntar varios cambios seguidos en una sola escritura. */
const SAVE_DELAY_MS = 800

/**
 * Filtros de la vista principal (step-13, D-38): se aplican al instante y se guardan en
 * `users/{uid}.prefs.filters` (los mismos en todos los proyectos y dispositivos).
 */
export const useFiltersStore = defineStore('filters', () => {
  const profileStore = useProfileStore()

  const filters = ref<TaskFilters>(normalizeFilters(profileStore.prefs.filters))
  /** Hay cambios locales sin guardar: no se pisan con lo que llegue del servidor. */
  let dirty = false
  let timer: ReturnType<typeof setTimeout> | null = null

  // Si cambian en otro dispositivo (o al cargar el perfil), se actualizan aquí.
  watch(
    () => profileStore.prefs.filters,
    (remote) => {
      if (!dirty) filters.value = normalizeFilters(remote)
    },
    { deep: true },
  )

  function scheduleSave(): void {
    dirty = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(async () => {
      timer = null
      try {
        await profileStore.updatePrefs({ filters: { ...filters.value } })
      } finally {
        dirty = false
      }
    }, SAVE_DELAY_MS)
  }

  function update(patch: Partial<TaskFilters>): void {
    filters.value = { ...filters.value, ...patch }
    scheduleSave()
  }

  function toggleIn<K extends 'hiddenStatuses' | 'tagIds' | 'priorities'>(
    key: K,
    value: TaskFilters[K][number],
  ): void {
    const list = filters.value[key] as string[]
    update({
      [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
    } as Partial<TaskFilters>)
  }

  /** Quita los filtros pero conserva el orden elegido. */
  function clear(): void {
    update({ ...DEFAULT_FILTERS, sort: filters.value.sort, sortDir: filters.value.sortDir })
  }

  const activeCount = computed(() => activeFilterCount(filters.value))

  return { filters, activeCount, update, toggleIn, clear }
})
