import { onScopeDispose, ref } from 'vue'

/** ¿Cumple la pantalla la consulta? Se actualiza al girar o cambiar el tamaño de la ventana. */
export function useMediaQuery(query: string) {
  const list = typeof window !== 'undefined' ? window.matchMedia?.(query) : undefined
  const matches = ref(list?.matches ?? false)
  const update = (event: MediaQueryListEvent) => (matches.value = event.matches)
  list?.addEventListener('change', update)
  onScopeDispose(() => list?.removeEventListener('change', update))
  return matches
}
