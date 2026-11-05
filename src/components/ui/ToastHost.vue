<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { CircleAlert, CircleCheck, TriangleAlert, X } from 'lucide-vue-next'
import { useToastsStore } from '@/stores/toasts'

/** Pinta los avisos de `useToastsStore` abajo a la derecha (centrados en móvil). */
const { t } = useI18n()
const toastsStore = useToastsStore()

const ICONS = { success: CircleCheck, warning: TriangleAlert, error: CircleAlert } as const
const ICON_COLORS = {
  success: 'text-emerald-500',
  warning: 'text-mustard-500',
  error: 'text-coral-500',
} as const
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 md:inset-x-auto md:right-6 md:items-end"
    role="status"
    aria-live="polite"
  >
    <div
      v-for="toast in toastsStore.toasts"
      :key="toast.id"
      class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg bg-gray-800 p-4 font-text text-sm text-white shadow-lg dark:bg-gray-700"
    >
      <component
        :is="ICONS[toast.tone]"
        :class="['mt-0.5 h-5 w-5 shrink-0', ICON_COLORS[toast.tone]]"
        aria-hidden="true"
      />
      <p class="m-0 flex-1 leading-normal">{{ toast.text }}</p>
      <button
        type="button"
        class="cursor-pointer border-0 bg-transparent p-0 text-gray-400 transition hover:text-white"
        :aria-label="t('toasts.close')"
        @click="toastsStore.dismiss(toast.id)"
      >
        <X class="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
