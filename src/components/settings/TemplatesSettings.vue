<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Trash2 } from 'lucide-vue-next'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { useTemplates } from '@/composables/useTemplates'
import type { TaskTemplate } from '@/domain/templates'
import { useToastsStore } from '@/stores/toasts'

/** Plantillas en Ajustes (v1.1.0, D-10): la lista, con lo que lleva cada una, y borrarlas. */
const { t } = useI18n()
const toasts = useToastsStore()
const { templates, loading, remove } = useTemplates()

const deleting = ref<TaskTemplate | null>(null)
const busy = ref(false)

async function confirmDelete(): Promise<void> {
  if (!deleting.value) return
  busy.value = true
  try {
    await remove(deleting.value.id)
    toasts.show(t('templates.deleted', { name: deleting.value.name }))
    deleting.value = null
  } catch {
    toasts.show(t('templates.failed'), 'error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="flex flex-col gap-4 rounded-lg border border-gray-200 p-5 dark:border-gray-700">
    <h2 class="m-0 font-text text-base font-bold text-gray-800 dark:text-white">
      {{ t('templates.title') }}
    </h2>
    <p class="m-0 font-text text-sm text-gray-500 dark:text-gray-400">
      {{ t('templates.help') }}
    </p>
    <p v-if="loading" class="m-0 font-text text-sm text-gray-500 dark:text-gray-400">
      {{ t('templates.loading') }}
    </p>
    <ul v-else-if="templates.length" class="m-0 flex list-none flex-col gap-1 p-0">
      <li
        v-for="template in templates"
        :key="template.id"
        class="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <span class="min-w-0 flex-1">
          <span class="block truncate font-text text-sm font-bold text-gray-800 dark:text-white">{{
            template.name
          }}</span>
          <span class="block truncate font-text text-xs text-gray-500 dark:text-gray-400">
            {{ template.title }} ·
            {{ t('templates.subtasksCount', template.subtasks.length) }}
          </span>
        </span>
        <button
          type="button"
          class="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-gray-500 transition hover:bg-gray-200 hover:text-coral-700 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-gray-400 dark:hover:bg-gray-700"
          :aria-label="t('templates.delete', { name: template.name })"
          :title="t('templates.delete', { name: template.name })"
          @click="deleting = template"
        >
          <Trash2 class="h-4 w-4" aria-hidden="true" />
        </button>
      </li>
    </ul>
    <p v-else class="m-0 font-text text-sm text-gray-500 dark:text-gray-400">
      {{ t('templates.empty') }}
    </p>

    <ConfirmDialog
      :open="deleting !== null"
      :title="t('templates.confirmTitle')"
      :message="deleting ? t('templates.confirmMessage', { name: deleting.name }) : ''"
      :confirm-label="t('common.delete')"
      :cancel-label="t('common.cancel')"
      :busy="busy"
      @confirm="confirmDelete"
      @cancel="deleting = null"
    />
  </section>
</template>
