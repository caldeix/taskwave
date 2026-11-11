<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { RefreshCw } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import { shouldCheckForUpdate } from '@/domain/pwa'
import { useToastsStore } from '@/stores/toasts'

/**
 * Service worker de la PWA (step-26, D-50, R-14): cuando hay una versión nueva, un aviso con
 * «Recargar» la aplica (nunca se cambia sola a mitad de trabajo). La primera vez que queda
 * guardada, avisa de que ya abre sin conexión. Desde la v1.3.2, al volver a la pestaña (o a la
 * app instalada) pregunta al navegador si hay versión nueva, como mucho una vez cada 5 minutos:
 * el navegador solo lo mira al cargar la página.
 */
const { t } = useI18n()
const toasts = useToastsStore()
let registration: ServiceWorkerRegistration | undefined
let lastCheckMs: number | null = null
const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    registration = reg
    lastCheckMs = Date.now()
  },
})

function checkForUpdate(): void {
  const now = Date.now()
  const state = { visible: document.visibilityState === 'visible', online: navigator.onLine }
  if (!registration || !shouldCheckForUpdate(lastCheckMs, now, state)) return
  lastCheckMs = now
  // Si hay versión nueva, `needRefresh` se activa solo y sale el aviso.
  registration.update().catch(() => {})
}
onMounted(() => document.addEventListener('visibilitychange', checkForUpdate))
onBeforeUnmount(() => document.removeEventListener('visibilitychange', checkForUpdate))

watch(offlineReady, (ready) => {
  if (ready) toasts.show(t('pwa.offlineReady'))
})
</script>

<template>
  <div
    v-if="needRefresh"
    class="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900"
    role="status"
  >
    <RefreshCw class="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
    <p class="m-0 min-w-0 flex-1 font-text text-sm text-gray-800 dark:text-white">
      {{ t('pwa.newVersion') }}
    </p>
    <div class="flex gap-2">
      <BaseButton variant="ghost" @click="needRefresh = false">{{ t('pwa.later') }}</BaseButton>
      <BaseButton @click="updateServiceWorker(true)">{{ t('pwa.reload') }}</BaseButton>
    </div>
  </div>
</template>
