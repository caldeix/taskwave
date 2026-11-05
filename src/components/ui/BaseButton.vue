<script setup lang="ts">
import { computed } from 'vue'

/**
 * Botón del DS Personal. `primary` y `secondary` son los del DS; `success`, `danger` y `ghost`
 * se añaden para TaskWave con los colores que ya tiene el DS.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost'

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant
    type?: 'button' | 'submit' | 'reset'
    selected?: boolean
    disabled?: boolean
    block?: boolean
  }>(),
  { variant: 'primary', type: 'button', selected: false, disabled: false, block: false },
)

const BASE =
  'inline-flex items-center justify-center gap-2 h-10 px-4 border-0 rounded-lg font-text text-sm font-bold cursor-pointer no-underline transition focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed dark:disabled:bg-gray-700 dark:disabled:text-gray-400'

const VARIANTS: Record<ButtonVariant, { normal: string; selected: string }> = {
  primary: {
    normal: 'bg-blue-500 text-white hover:bg-blue-600',
    selected: 'bg-blue-600 text-white',
  },
  secondary: {
    normal:
      'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600',
    selected: 'bg-gray-300 text-gray-800 dark:bg-gray-600 dark:text-white',
  },
  success: {
    normal: 'bg-emerald-500 text-gray-900 hover:bg-emerald-700 hover:text-white',
    selected: 'bg-emerald-700 text-white',
  },
  danger: {
    normal: 'bg-coral-500 text-gray-900 hover:bg-coral-700 hover:text-white',
    selected: 'bg-coral-700 text-white',
  },
  ghost: {
    normal: 'bg-transparent text-gray-800 hover:bg-gray-200 dark:text-white dark:hover:bg-gray-700',
    selected: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-white',
  },
}

const classes = computed(() => [
  BASE,
  props.selected ? VARIANTS[props.variant].selected : VARIANTS[props.variant].normal,
  props.block ? 'w-full' : '',
])
</script>

<template>
  <button :type="type" :class="classes" :disabled="disabled" :aria-pressed="selected || undefined">
    <slot />
  </button>
</template>
