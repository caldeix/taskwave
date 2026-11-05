<script setup lang="ts">
import { useId } from 'vue'

/** Campo de texto del DS Personal, con etiqueta, ayuda y mensaje de error. */
defineProps<{
  label: string
  type?: 'text' | 'email' | 'password'
  autocomplete?: string
  placeholder?: string
  help?: string
  error?: string
  required?: boolean
  disabled?: boolean
}>()

const model = defineModel<string>({ default: '' })
const id = useId()
</script>

<template>
  <div class="flex flex-col">
    <label :for="id" class="mb-1 block font-text text-sm font-medium text-gray-800 dark:text-white">
      {{ label }}
    </label>
    <input
      :id="id"
      v-model="model"
      :type="type ?? 'text'"
      :autocomplete="autocomplete"
      :placeholder="placeholder"
      :required="required"
      :disabled="disabled"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="error ? `${id}-error` : help ? `${id}-help` : undefined"
      :class="[
        'h-10 w-full rounded-lg border-0 bg-gray-100 px-4 font-text text-sm text-gray-800 transition placeholder:text-gray-500 focus:outline-2 focus:outline-blue-500 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-400 dark:disabled:bg-gray-700 dark:disabled:text-gray-400',
        error ? 'outline-2 outline-coral-500' : '',
      ]"
    />
    <p
      v-if="error"
      :id="`${id}-error`"
      class="m-0 mt-1 font-text text-sm font-medium text-coral-700 dark:text-coral-500"
    >
      {{ error }}
    </p>
    <p
      v-else-if="help"
      :id="`${id}-help`"
      class="m-0 mt-1 font-text text-sm text-gray-500 dark:text-gray-400"
    >
      {{ help }}
    </p>
  </div>
</template>
