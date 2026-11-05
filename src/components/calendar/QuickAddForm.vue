<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * Alta rápida dentro de un día del calendario (D-22): título + Enter crea la tarea en ese día;
 * Esc cancela; «Más opciones» abre el formulario completo con el día puesto.
 */
const props = defineProps<{ dayLabel: string; busy: boolean }>()
const emit = defineEmits<{ create: [title: string]; more: [title: string]; close: [] }>()

const { t } = useI18n()
const title = ref('')
const input = ref<HTMLInputElement | null>(null)

onMounted(async () => {
  await nextTick()
  input.value?.focus()
})

function submit(): void {
  if (title.value.trim() && !props.busy) emit('create', title.value.trim())
}
</script>

<template>
  <form
    class="flex w-64 flex-col gap-2 rounded-lg border border-gray-500 bg-white p-3 shadow-lg dark:border-gray-400 dark:bg-gray-900"
    @submit.prevent="submit"
    @keydown.esc.stop.prevent="emit('close')"
    @click.stop
  >
    <label class="font-text text-xs font-bold text-gray-500 dark:text-gray-400">
      {{ t('calendar.quickAdd', { day: dayLabel }) }}
      <input
        ref="input"
        v-model="title"
        type="text"
        maxlength="200"
        :placeholder="t('calendar.quickAddPlaceholder')"
        class="mt-1 h-9 w-full rounded-lg border-0 bg-gray-100 px-3 font-text text-sm font-normal text-gray-800 placeholder:text-gray-500 focus:outline-2 focus:outline-blue-500 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-400"
      />
    </label>
    <div class="flex items-center justify-between gap-2">
      <button
        type="button"
        class="cursor-pointer border-0 bg-transparent p-0 font-text text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
        @click="emit('more', title.trim())"
      >
        {{ t('calendar.moreOptions') }}
      </button>
      <span class="font-text text-xs text-gray-500 dark:text-gray-400">{{
        t('calendar.enterHint')
      }}</span>
    </div>
  </form>
</template>
