<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { RotateCcw, Trash2 } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import {
  TRASH_DAYS,
  deleteFromTrash,
  purgeOldTrash,
  restoreFromTrash,
  trashEntryFromData,
  trashQuery,
  type TrashEntry,
} from '@/data/trash'
import { formatRelative } from '@/lib/format'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/stores/auth'
import { useToastsStore } from '@/stores/toasts'

/**
 * Papelera en Ajustes (plan TASKWAVE-02, idea 10, D-11, CA-10b): las tareas borradas en los
 * últimos 30 días, para restaurarlas o borrarlas del todo. Al abrirla se vacía lo más antiguo.
 */
const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const toasts = useToastsStore()
const uid = computed(() => authStore.user?.uid ?? null)

const entries = ref<TrashEntry[]>([])
const loading = ref(true)
const busy = ref<string | null>(null)
const confirming = ref<TrashEntry | 'all' | null>(null)
let stop: Unsubscribe | null = null

onMounted(async () => {
  if (!uid.value) return
  try {
    await purgeOldTrash(db, uid.value)
  } catch {
    // Sin conexión: se vaciará la próxima vez.
  }
  stop = onSnapshot(
    trashQuery(db, uid.value),
    (snap) => {
      entries.value = snap.docs.map((d) => trashEntryFromData(d.id, d.data()))
      loading.value = false
    },
    () => (loading.value = false),
  )
})
onScopeDispose(() => stop?.())

async function restore(entry: TrashEntry): Promise<void> {
  if (!uid.value || busy.value) return
  busy.value = entry.id
  try {
    const key = await restoreFromTrash(db, uid.value, entry.id)
    toasts.show(t('trash.restored', { key }))
    void router.push({ name: 'task', params: { taskKey: key } })
  } catch {
    toasts.show(t('trash.failed'), 'error')
  } finally {
    busy.value = null
  }
}

async function confirmDelete(): Promise<void> {
  const target = confirming.value
  if (!uid.value || !target) return
  busy.value = 'delete'
  try {
    const list = target === 'all' ? entries.value : [target]
    for (const entry of list) await deleteFromTrash(db, uid.value, entry.id)
    toasts.show(t('trash.deleted', list.length))
    confirming.value = null
  } catch {
    toasts.show(t('trash.failed'), 'error')
  } finally {
    busy.value = null
  }
}

const iconButton =
  'inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-gray-500 transition hover:bg-gray-200 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white'
</script>

<template>
  <section class="flex flex-col gap-4 rounded-lg border border-gray-200 p-5 dark:border-gray-700">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="m-0 font-text text-base font-bold text-gray-800 dark:text-white">
        {{ t('trash.title') }}
      </h2>
      <BaseButton
        v-if="entries.length"
        variant="ghost"
        :disabled="busy !== null"
        @click="confirming = 'all'"
      >
        {{ t('trash.empty') }}
      </BaseButton>
    </div>
    <p class="m-0 font-text text-sm text-gray-500 dark:text-gray-400">
      {{ t('trash.help', { days: TRASH_DAYS }) }}
    </p>
    <p v-if="loading" class="m-0 font-text text-sm text-gray-500 dark:text-gray-400">
      {{ t('trash.loading') }}
    </p>
    <ul v-else-if="entries.length" class="m-0 flex list-none flex-col gap-1 p-0">
      <li
        v-for="entry in entries"
        :key="entry.id"
        class="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <span class="min-w-0 flex-1">
          <span class="block truncate font-text text-sm text-gray-800 dark:text-white">
            <strong class="text-gray-500 dark:text-gray-400">{{ entry.key }}</strong>
            {{ entry.title }}
          </span>
          <span class="block font-text text-xs text-gray-500 dark:text-gray-400">
            {{ formatRelative(entry.deletedAtMs, Date.now()) }} ·
            {{ t('trash.contents', { comments: entry.comments, worklogs: entry.worklogs }) }}
          </span>
        </span>
        <button
          type="button"
          :class="iconButton"
          :disabled="busy !== null"
          :aria-label="t('trash.restore', { key: entry.key })"
          :title="t('trash.restore', { key: entry.key })"
          @click="restore(entry)"
        >
          <RotateCcw class="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          :class="[iconButton, 'hover:text-coral-700']"
          :disabled="busy !== null"
          :aria-label="t('trash.deleteForever', { key: entry.key })"
          :title="t('trash.deleteForever', { key: entry.key })"
          @click="confirming = entry"
        >
          <Trash2 class="h-4 w-4" aria-hidden="true" />
        </button>
      </li>
    </ul>
    <p v-else class="m-0 font-text text-sm text-gray-500 dark:text-gray-400">
      {{ t('trash.none') }}
    </p>

    <ConfirmDialog
      :open="confirming !== null"
      :title="t('trash.confirmTitle')"
      :message="
        confirming === 'all'
          ? t('trash.confirmAll', entries.length)
          : confirming
            ? t('trash.confirmOne', { key: confirming.key })
            : ''
      "
      :confirm-label="t('trash.deleteForeverShort')"
      :cancel-label="t('common.cancel')"
      :busy="busy === 'delete'"
      @confirm="confirmDelete"
      @cancel="confirming = null"
    />
  </section>
</template>
