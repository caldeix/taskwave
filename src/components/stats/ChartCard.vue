<script setup lang="ts">
/** Tarjeta de un gráfico (step-23): título, nota y el gráfico. */
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <section
    class="flex min-w-0 flex-col gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
  >
    <header class="flex flex-col gap-0.5">
      <h2 class="m-0 font-text text-base font-bold text-gray-800 dark:text-white">{{ title }}</h2>
      <p v-if="subtitle" class="m-0 font-text text-sm text-gray-500 dark:text-gray-400">
        {{ subtitle }}
      </p>
    </header>
    <slot />
  </section>
</template>
