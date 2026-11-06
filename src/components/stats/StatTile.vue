<script setup lang="ts">
/** Ficha de una cifra (step-23): etiqueta, valor grande y una nota opcional. */
defineProps<{ label: string; value: string; hint?: string }>()
</script>

<template>
  <div
    class="flex min-w-0 flex-col gap-1 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
  >
    <span class="font-text text-sm text-gray-500 dark:text-gray-400">{{ label }}</span>
    <span class="font-text text-3xl leading-tight font-semibold text-gray-800 dark:text-white">{{
      value
    }}</span>
    <span v-if="hint" class="font-text text-xs text-gray-500 dark:text-gray-400">{{ hint }}</span>
  </div>
</template>
