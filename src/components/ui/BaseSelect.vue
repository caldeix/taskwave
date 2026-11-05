<script setup lang="ts">
import { useId } from 'vue'

/** Selector del DS Personal, con etiqueta y error. Las opciones van en el slot (`<option>`). */
defineProps<{ label: string; error?: string; disabled?: boolean }>()
const model = defineModel<string>({ default: '' })
const id = useId()
</script>

<template>
  <div class="flex flex-col">
    <label :for="id" class="mb-1 block font-text text-sm font-medium text-gray-800 dark:text-white">
      {{ label }}
    </label>
    <select
      :id="id"
      v-model="model"
      :disabled="disabled"
      :aria-invalid="error ? 'true' : undefined"
      :class="[
        'h-10 w-full cursor-pointer rounded-lg border-0 bg-gray-100 px-4 font-text text-sm text-gray-800 transition focus:outline-2 focus:outline-blue-500 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 dark:bg-gray-800 dark:text-white dark:disabled:bg-gray-700 dark:disabled:text-gray-400',
        error ? 'outline-2 outline-coral-500' : '',
      ]"
    >
      <slot />
    </select>
    <p
      v-if="error"
      class="m-0 mt-1 font-text text-sm font-medium text-coral-700 dark:text-coral-500"
    >
      {{ error }}
    </p>
  </div>
</template>
