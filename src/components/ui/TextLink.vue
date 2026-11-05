<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router'

/** Enlace de texto del DS Personal (azul, en negrita al pasar el ratón). */
defineProps<{ to: RouteLocationRaw }>()
</script>

<template>
  <RouterLink
    :to="to"
    class="cursor-pointer font-text text-sm font-medium text-blue-600 no-underline transition hover:font-semibold hover:text-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-blue-400"
  >
    <slot />
  </RouterLink>
</template>
