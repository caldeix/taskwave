<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search } from 'lucide-vue-next'
import { filterCommands, type Command } from '@/domain/commands'

/**
 * Paleta de comandos (plan TASKWAVE-02, idea 3, D-4): un diálogo con un buscador y la lista de
 * acciones agrupadas. Flechas para moverse, Enter para ejecutar y Esc para cerrar.
 */
const props = defineProps<{ open: boolean; commands: Command[]; title: string }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const dialog = ref<HTMLDialogElement | null>(null)
const input = ref<HTMLInputElement | null>(null)
const text = ref('')
const active = ref(0)
const listId = `commands-${Math.random().toString(36).slice(2, 8)}`

const results = computed(() => filterCommands(props.commands, text.value))
watch(results, () => (active.value = 0))

watch(
  () => props.open,
  async (open) => {
    if (!dialog.value) return
    if (open) {
      text.value = ''
      active.value = 0
      if (!dialog.value.open) dialog.value.showModal()
      await nextTick()
      input.value?.focus()
    } else if (dialog.value.open) dialog.value.close()
  },
  { flush: 'post' },
)

/** Cabecera de grupo solo cuando cambia respecto al anterior. */
function showGroup(index: number): boolean {
  return index === 0 || results.value[index - 1]!.group !== results.value[index]!.group
}

async function run(command: Command | undefined): Promise<void> {
  if (!command) return
  emit('close')
  await command.run()
}

function onKeydown(event: KeyboardEvent): void {
  const count = results.value.length
  if (event.key === 'ArrowDown' && count) {
    event.preventDefault()
    active.value = (active.value + 1) % count
    scrollActive()
  } else if (event.key === 'ArrowUp' && count) {
    event.preventDefault()
    active.value = (active.value - 1 + count) % count
    scrollActive()
  } else if (event.key === 'Enter') {
    event.preventDefault()
    void run(results.value[active.value])
  }
}

function scrollActive(): void {
  void nextTick(() =>
    dialog.value?.querySelector(`#${listId}-${active.value}`)?.scrollIntoView({ block: 'nearest' }),
  )
}
</script>

<template>
  <dialog
    ref="dialog"
    class="m-auto mt-[12vh] max-h-[70dvh] w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-lg border border-gray-500 bg-white p-0 text-gray-800 backdrop:bg-gray-900/60 dark:border-gray-400 dark:bg-gray-900 dark:text-white"
    :aria-label="title"
    @cancel.prevent="emit('close')"
    @click.self="emit('close')"
  >
    <div v-if="open" class="flex max-h-[70dvh] flex-col">
      <div class="flex items-center gap-2 border-b border-gray-200 px-4 dark:border-gray-700">
        <Search class="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" aria-hidden="true" />
        <input
          ref="input"
          v-model="text"
          type="text"
          role="combobox"
          autocomplete="off"
          :aria-label="title"
          :aria-expanded="results.length > 0"
          :aria-controls="listId"
          :aria-activedescendant="results.length ? `${listId}-${active}` : undefined"
          :placeholder="t('commands.placeholder')"
          class="h-12 min-w-0 flex-1 border-0 bg-transparent font-text text-sm text-gray-800 placeholder:text-gray-500 focus:outline-none dark:text-white dark:placeholder:text-gray-400"
          @keydown="onKeydown"
        />
        <kbd
          class="rounded border border-gray-300 px-1.5 font-mono text-xs text-gray-500 dark:border-gray-600 dark:text-gray-400"
          >Esc</kbd
        >
      </div>
      <ul
        v-if="results.length"
        :id="listId"
        role="listbox"
        class="m-0 flex list-none flex-col overflow-y-auto p-1"
      >
        <template v-for="(command, index) in results" :key="command.id">
          <li
            v-if="showGroup(index)"
            role="presentation"
            class="px-3 pt-2 pb-1 font-text text-xs font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400"
          >
            {{ command.group }}
          </li>
          <li
            :id="`${listId}-${index}`"
            role="option"
            :aria-selected="index === active"
            :class="[
              'cursor-pointer rounded-md px-3 py-2 font-text text-sm',
              index === active
                ? 'bg-blue-600 text-white'
                : 'text-gray-800 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-800',
            ]"
            @mouseenter="active = index"
            @click="run(command)"
          >
            {{ command.label }}
          </li>
        </template>
      </ul>
      <p v-else class="m-0 px-4 py-6 font-text text-sm text-gray-500 dark:text-gray-400">
        {{ t('commands.empty') }}
      </p>
    </div>
  </dialog>
</template>
