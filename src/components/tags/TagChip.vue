<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { PROJECT_COLOR_CLASSES } from '@/domain/projects'
import type { Tag } from '@/domain/tags'

/**
 * Tag con su color (D-40): punto de color y nombre sobre gris, como los proyectos del menú.
 * `small` para las tarjetas del kanban; con `removeLabel` muestra la «x» para quitarlo.
 */
defineProps<{ tag: Tag; small?: boolean; removeLabel?: string }>()
const emit = defineEmits<{ remove: [] }>()
</script>

<template>
  <span
    :class="[
      'inline-flex max-w-full min-w-0 items-center rounded-full bg-gray-100 font-text text-gray-800 dark:bg-gray-800 dark:text-white',
      small ? 'h-5 gap-1 px-2 text-xs' : 'h-7 gap-1.5 pr-1 pl-2.5 text-sm',
      !small && !removeLabel ? 'pr-2.5' : '',
    ]"
  >
    <span
      :class="[
        'shrink-0 rounded-full',
        small ? 'h-1.5 w-1.5' : 'h-2 w-2',
        PROJECT_COLOR_CLASSES[tag.color]?.dot ?? 'bg-gray-500',
      ]"
      aria-hidden="true"
    />
    <span class="truncate">{{ tag.name }}</span>
    <button
      v-if="removeLabel"
      type="button"
      class="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-gray-500 transition hover:bg-gray-300 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-white"
      :aria-label="removeLabel"
      :title="removeLabel"
      @click="emit('remove')"
    >
      <X class="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  </span>
</template>
