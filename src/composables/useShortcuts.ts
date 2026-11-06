import { onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isTypingTarget, shortcutAction } from '@/domain/shortcuts'
import { viewToQuery, type MainView } from '@/domain/views'
import { useProfileStore } from '@/stores/profile'
import { useUiStore } from '@/stores/ui'

const MAIN_ROUTES = ['home', 'inbox', 'project']

/**
 * Atajos de teclado globales (step-24, D-52), activos en toda la app con sesión. Con un diálogo
 * abierto solo funciona `Ctrl+K` (y si el abierto es el propio buscador, no hace nada).
 */
export function useShortcuts() {
  const route = useRoute()
  const router = useRouter()
  const ui = useUiStore()
  const profileStore = useProfileStore()

  const onMain = () => MAIN_ROUTES.includes(String(route.name))

  function showView(view: MainView): void {
    void profileStore.updatePrefs({ view })
    if (onMain()) void router.replace({ query: { ...route.query, vista: viewToQuery(view) } })
    else void router.push({ name: 'home', query: { vista: viewToQuery(view) } })
  }

  function onKeydown(event: KeyboardEvent): void {
    const action = shortcutAction(event, isTypingTarget(event.target))
    if (!action) return
    const dialogOpen = document.querySelector('dialog[open]') !== null
    if (action === 'search') {
      if (ui.searchOpen) return
      if (dialogOpen && !(event.ctrlKey || event.metaKey)) return
      event.preventDefault()
      ui.openSearch()
      return
    }
    if (dialogOpen) return
    event.preventDefault()
    if (action === 'newTask') {
      ui.requestNewTask()
      if (!onMain()) void router.push({ name: 'home' })
    } else showView(action)
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))
}
