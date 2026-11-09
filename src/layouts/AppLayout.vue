<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Menu, Search } from 'lucide-vue-next'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import SearchDialog from '@/components/search/SearchDialog.vue'
import TimerDialogs from '@/components/timer/TimerDialogs.vue'
import TimerPill from '@/components/timer/TimerPill.vue'
import { createAutomationApi } from '@/automation/api'
import { useShortcuts } from '@/composables/useShortcuts'
import { useThemeSync } from '@/composables/useThemeSync'
import { useProfileStore } from '@/stores/profile'
import { useUiStore } from '@/stores/ui'

/**
 * Estructura de la app (step-8): menú lateral plegable a la izquierda (guardado en
 * `prefs.sidebarCollapsed`) y el contenido a la derecha. En móvil el menú es un cajón (D-49).
 * El mini cronómetro (step-19) va en el menú y, en móvil, en la cabecera. Los atajos de teclado y
 * el buscador `Ctrl+K` (step-24) funcionan en toda la app. Con la sesión dentro se instala la
 * API de automatización `window.taskwave` (v1.3.0), para usar TaskWave desde Claude.
 */
const { t } = useI18n()
const route = useRoute()
const profileStore = useProfileStore()
const ui = useUiStore()
useShortcuts()
useThemeSync()

// API de automatización (v1.3.0): solo con una cuenta activa, que es cuando se monta este layout.
const automation = createAutomationApi()
onMounted(() => (window.taskwave = automation))
onBeforeUnmount(() => {
  if (window.taskwave === automation) delete window.taskwave
})

const collapsed = computed(() => profileStore.prefs.sidebarCollapsed)
const drawerOpen = ref(false)

function toggleCollapsed(): void {
  void profileStore.updatePrefs({ sidebarCollapsed: !collapsed.value })
}

// Al navegar desde el cajón, se cierra.
watch(
  () => route.fullPath,
  () => (drawerOpen.value = false),
)

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') drawerOpen.value = false
}
</script>

<template>
  <div class="flex min-h-dvh">
    <!-- Escritorio y tablet: menú fijo, plegable -->
    <aside
      :class="[
        'sticky top-0 hidden h-dvh shrink-0 border-r border-gray-200 transition-[width] duration-200 md:block dark:border-gray-700',
        collapsed ? 'w-18' : 'w-64',
      ]"
    >
      <AppSidebar :collapsed="collapsed" @toggle="toggleCollapsed" />
    </aside>

    <!-- Móvil: cajón por encima del contenido -->
    <div v-if="drawerOpen" class="fixed inset-0 z-40 md:hidden" @keydown="onKeydown">
      <div class="absolute inset-0 bg-gray-900/60" aria-hidden="true" @click="drawerOpen = false" />
      <aside class="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-lg">
        <AppSidebar :collapsed="false" mobile @close="drawerOpen = false" />
      </aside>
    </div>

    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-gray-200 bg-white px-4 md:hidden dark:border-gray-700 dark:bg-gray-900"
      >
        <button
          type="button"
          class="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-gray-800 transition hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-white dark:hover:bg-gray-700"
          :aria-label="t('nav.openMenu')"
          :aria-expanded="drawerOpen"
          @click="drawerOpen = true"
        >
          <Menu class="h-5 w-5" aria-hidden="true" />
        </button>
        <span
          class="bg-radial-blue bg-clip-text font-title text-3xl leading-tight font-semibold text-transparent"
        >
          {{ t('app.name') }}
        </span>
        <TimerPill class="ml-auto" compact />
        <button
          type="button"
          class="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-gray-800 transition hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-white dark:hover:bg-gray-700"
          :aria-label="t('search.button')"
          @click="ui.openSearch()"
        >
          <Search class="h-5 w-5" aria-hidden="true" />
        </button>
      </header>
      <RouterView />
    </div>

    <TimerDialogs />
    <SearchDialog />
  </div>
</template>
