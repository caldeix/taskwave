<script setup lang="ts">
/** Mensaje de estado del DS Personal (éxito, aviso o error) para formularios. */
defineProps<{ tone: 'success' | 'warning' | 'error' }>()

const TONES = {
  success: 'text-emerald-700 dark:text-emerald-500',
  warning: 'text-mustard-700 dark:text-mustard-500',
  error: 'text-coral-700 dark:text-coral-500',
} as const
</script>

<template>
  <p
    :role="tone === 'error' ? 'alert' : 'status'"
    :class="['m-0 font-text text-sm font-medium', TONES[tone]]"
  >
    <slot />
  </p>
</template>
