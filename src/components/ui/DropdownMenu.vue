<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch, type Component } from 'vue'
import { EllipsisVertical } from 'lucide-vue-next'

/**
 * Menú desplegable de acciones (botón de tres puntos). Se cierra al elegir, al pulsar fuera o
 * con Esc, y se maneja con las flechas del teclado.
 */
export interface MenuItem {
  key: string
  label: string
  icon?: Component
  danger?: boolean
  disabled?: boolean
}

defineProps<{ items: MenuItem[]; label: string }>()
const emit = defineEmits<{ select: [key: string] }>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const menuId = useId()

function close(): void {
  open.value = false
}

function onDocumentClick(event: MouseEvent): void {
  if (root.value && !root.value.contains(event.target as Node)) close()
}

watch(open, async (isOpen) => {
  if (isOpen) {
    document.addEventListener('click', onDocumentClick, true)
    await nextTick()
    root.value?.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])')?.focus()
  } else {
    document.removeEventListener('click', onDocumentClick, true)
  }
})
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick, true))

function choose(item: MenuItem): void {
  if (item.disabled) return
  close()
  emit('select', item.key)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    close()
    root.value?.querySelector<HTMLButtonElement>('[aria-haspopup]')?.focus()
    return
  }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  event.preventDefault()
  const items = [
    ...(root.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? []),
  ]
  const index = items.indexOf(document.activeElement as HTMLButtonElement)
  const next = event.key === 'ArrowDown' ? index + 1 : index - 1
  items[(next + items.length) % items.length]?.focus()
}
</script>

<template>
  <div ref="root" class="relative" @keydown="onKeydown">
    <button
      type="button"
      :aria-label="label"
      :title="label"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="menuId"
      class="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-gray-500 transition hover:bg-gray-200 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
      @click.stop="open = !open"
    >
      <EllipsisVertical class="h-4 w-4" aria-hidden="true" />
    </button>
    <div
      v-if="open"
      :id="menuId"
      role="menu"
      class="absolute right-0 z-30 mt-1 flex min-w-44 flex-col rounded-lg border border-gray-500 bg-white p-1 shadow-lg dark:border-gray-400 dark:bg-gray-800"
    >
      <button
        v-for="item in items"
        :key="item.key"
        type="button"
        role="menuitem"
        :disabled="item.disabled"
        :class="[
          'flex h-9 cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-3 text-left font-text text-sm transition focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50',
          item.danger
            ? 'text-coral-700 hover:bg-gray-100 dark:text-coral-500 dark:hover:bg-gray-700'
            : 'text-gray-800 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700',
        ]"
        @click="choose(item)"
      >
        <component :is="item.icon" v-if="item.icon" class="h-4 w-4 shrink-0" aria-hidden="true" />
        {{ item.label }}
      </button>
    </div>
  </div>
</template>
