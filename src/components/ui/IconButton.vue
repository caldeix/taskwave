<script setup lang="ts">
/** Botón redondo de icono del DS Personal (p. ej. el conmutador de tema). */
defineProps<{ label: string }>()
</script>

<template>
  <button
    type="button"
    :aria-label="label"
    :title="label"
    class="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-gray-800 no-underline transition hover:-translate-y-px hover:bg-gray-700 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 motion-reduce:hover:translate-y-0 dark:text-white"
  >
    <slot />
  </button>
</template>
