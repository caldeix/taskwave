import { ref } from 'vue'

/** Modo elegido por el usuario. `system` sigue el modo del sistema operativo. */
export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'theme'

function readStored(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // localStorage no disponible (modo privado, etc.)
  }
  return 'system'
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches
  )
}

/** Indica si el modo efectivo es oscuro, resolviendo `system`. */
export function resolveIsDark(mode: ThemeMode, prefersDark: boolean): boolean {
  return mode === 'dark' || (mode === 'system' && prefersDark)
}

function applyMode(mode: ThemeMode): void {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  if (mode !== 'system') root.classList.add(mode)
  try {
    if (mode === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // Sin persistencia: el modo vale para esta sesión
  }
}

const mode = ref<ThemeMode>(readStored())
const isDark = ref(resolveIsDark(mode.value, systemPrefersDark()))

if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
    isDark.value = resolveIsDark(mode.value, event.matches)
  })
}

/**
 * Modo claro/oscuro con la misma convención que el DS Personal: clase `light` o `dark` en <html>
 * y la elección guardada en localStorage con la clave `theme`. El script de `index.html`
 * aplica la clase antes de pintar para evitar el destello.
 * Más adelante (step-25) la preferencia se sincronizará también en `users/{uid}.prefs.theme`.
 */
export function useTheme() {
  function setMode(next: ThemeMode): void {
    mode.value = next
    applyMode(next)
    isDark.value = resolveIsDark(next, systemPrefersDark())
  }

  function toggle(): void {
    setMode(isDark.value ? 'light' : 'dark')
  }

  return { mode, isDark, setMode, toggle }
}
