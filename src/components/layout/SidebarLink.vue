<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router'

/**
 * Enlace del menú lateral. Plegado solo muestra el icono (el texto queda como título y para
 * lectores de pantalla). La ruta activa sale en azul y negrita, como el enlace seleccionado del DS.
 */
defineProps<{
  to: RouteLocationRaw
  label: string
  collapsed?: boolean
  badge?: number
}>()
</script>

<template>
  <RouterLink v-slot="{ href, navigate, isExactActive }" :to="to" custom>
    <a
      :href="href"
      :title="collapsed ? label : undefined"
      :aria-current="isExactActive ? 'page' : undefined"
      :class="[
        'flex h-10 min-w-0 items-center gap-3 rounded-lg px-3 font-text text-sm no-underline transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600',
        collapsed ? 'justify-center' : '',
        isExactActive
          ? 'bg-white font-bold text-blue-600 dark:bg-gray-900 dark:text-blue-400'
          : 'font-medium text-gray-800 hover:bg-gray-200 dark:text-white dark:hover:bg-gray-700',
      ]"
      @click="navigate"
    >
      <span class="relative flex shrink-0 items-center">
        <slot name="icon" />
        <span
          v-if="collapsed && badge"
          class="absolute -top-1.5 -right-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-bold text-white"
          aria-hidden="true"
        >
          {{ badge }}
        </span>
      </span>
      <span v-if="!collapsed" class="min-w-0 flex-1 truncate">{{ label }}</span>
      <span v-else class="sr-only">{{ label }}</span>
      <span
        v-if="!collapsed && badge"
        class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-500 px-1.5 text-xs font-bold text-white"
      >
        {{ badge }}
      </span>
    </a>
  </RouterLink>
</template>
