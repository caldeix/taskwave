<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Download, FileSpreadsheet, Upload } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import FormMessage from '@/components/ui/FormMessage.vue'
import { exportBackup, importBackup, type ImportSummary } from '@/data/backup'
import { isBackupError, parseBackup, tasksToCsv, type Backup } from '@/domain/backup'
import { todayKey } from '@/domain/dates'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/stores/auth'
import { useProjectsStore } from '@/stores/projects'
import { useTagsStore } from '@/stores/tags'
import { useToastsStore } from '@/stores/toasts'

/**
 * Copia de seguridad en Ajustes (plan TASKWAVE-02, idea 10, D-12, CA-10a): descargar todo en JSON
 * (y las tareas en CSV) e importar una copia, que solo crea lo que no existe.
 */
const { t } = useI18n()
const authStore = useAuthStore()
const projectsStore = useProjectsStore()
const tagsStore = useTagsStore()
const toasts = useToastsStore()
const uid = computed(() => authStore.user?.uid ?? null)

const busy = ref<'json' | 'csv' | 'import' | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const pending = ref<Backup | null>(null)
const result = ref<ImportSummary | null>(null)

function download(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function exportAs(kind: 'json' | 'csv'): Promise<void> {
  if (!uid.value || busy.value) return
  busy.value = kind
  try {
    const backup = await exportBackup(db, uid.value, __APP_VERSION__)
    const stamp = todayKey()
    if (kind === 'json')
      download(`taskwave-${stamp}.json`, JSON.stringify(backup, null, 2), 'application/json')
    else
      download(
        `taskwave-tareas-${stamp}.csv`,
        tasksToCsv(backup.tasks, {
          project: (id) => (id ? (projectsStore.byId(id)?.name ?? '') : t('nav.inbox')),
          tag: (id) => tagsStore.all.find((tag) => tag.id === id)?.name ?? '',
        }),
        'text/csv;charset=utf-8',
      )
    toasts.show(t('backup.exported', { n: backup.tasks.length }))
  } catch {
    toasts.show(t('backup.exportFailed'), 'error')
  } finally {
    busy.value = null
  }
}

async function onFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  result.value = null
  if (!file) return
  const parsed = parseBackup(await file.text())
  if (isBackupError(parsed)) {
    toasts.show(t(`backup.errors.${parsed}`), 'error')
    return
  }
  pending.value = parsed
}

async function confirmImport(): Promise<void> {
  if (!uid.value || !pending.value) return
  busy.value = 'import'
  try {
    result.value = await importBackup(db, uid.value, pending.value)
    toasts.show(t('backup.imported', { n: result.value.tasks }))
  } catch {
    toasts.show(t('backup.importFailed'), 'error')
  } finally {
    busy.value = null
    pending.value = null
  }
}
</script>

<template>
  <section class="flex flex-col gap-4 rounded-lg border border-gray-200 p-5 dark:border-gray-700">
    <h2 class="m-0 font-text text-base font-bold text-gray-800 dark:text-white">
      {{ t('backup.title') }}
    </h2>
    <p class="m-0 font-text text-sm text-gray-500 dark:text-gray-400">{{ t('backup.help') }}</p>
    <div class="flex flex-wrap gap-2">
      <BaseButton variant="secondary" :disabled="busy !== null" @click="exportAs('json')">
        <Download class="h-4 w-4" aria-hidden="true" />
        {{ busy === 'json' ? t('backup.working') : t('backup.exportJson') }}
      </BaseButton>
      <BaseButton variant="secondary" :disabled="busy !== null" @click="exportAs('csv')">
        <FileSpreadsheet class="h-4 w-4" aria-hidden="true" />
        {{ busy === 'csv' ? t('backup.working') : t('backup.exportCsv') }}
      </BaseButton>
      <BaseButton variant="secondary" :disabled="busy !== null" @click="fileInput?.click()">
        <Upload class="h-4 w-4" aria-hidden="true" />
        {{ busy === 'import' ? t('backup.working') : t('backup.import') }}
      </BaseButton>
      <input
        ref="fileInput"
        type="file"
        accept="application/json,.json"
        class="sr-only"
        tabindex="-1"
        :aria-label="t('backup.import')"
        @change="onFile"
      />
    </div>
    <FormMessage v-if="result" tone="success">
      {{
        t('backup.summary', {
          tasks: result.tasks,
          projects: result.projects,
          tags: result.tags,
          comments: result.comments,
          worklogs: result.worklogs,
          templates: result.templates,
        })
      }}
      <template v-if="result.skippedKeys.length">
        {{ t('backup.skipped', { keys: result.skippedKeys.join(', ') }) }}
      </template>
    </FormMessage>

    <ConfirmDialog
      :open="pending !== null"
      :title="t('backup.confirmTitle')"
      :message="
        pending
          ? t('backup.confirmMessage', {
              tasks: pending.tasks.length,
              projects: pending.projects.length,
              date: pending.exportedAt.slice(0, 10),
            })
          : ''
      "
      :confirm-label="t('backup.import')"
      :cancel-label="t('common.cancel')"
      :busy="busy === 'import'"
      @confirm="confirmImport"
      @cancel="pending = null"
    />
  </section>
</template>
