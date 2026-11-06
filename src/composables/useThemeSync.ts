import { watch } from 'vue'
import { useTheme, type ThemeMode } from './useTheme'
import { useProfileStore } from '@/stores/profile'

/**
 * Tema sincronizado con el perfil (step-25): al cargar el perfil (o cambiarlo en otro
 * dispositivo) se aplica su `prefs.theme`; al elegir otro con `choose`, se guarda.
 */
export function useThemeSync() {
  const profileStore = useProfileStore()
  const theme = useTheme()

  watch(
    () => profileStore.profile?.prefs?.theme,
    (saved) => {
      if (saved && saved !== theme.mode.value) theme.setMode(saved)
    },
    { immediate: true },
  )

  return theme
}

/** Elige el tema y, con sesión, lo guarda en el perfil. */
export function useThemeChoice() {
  const profileStore = useProfileStore()
  const theme = useTheme()

  function choose(next: ThemeMode): void {
    theme.setMode(next)
    void profileStore.updatePrefs({ theme: next })
  }

  function toggle(): void {
    choose(theme.isDark.value ? 'light' : 'dark')
  }

  return { ...theme, choose, toggle }
}
