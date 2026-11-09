<script setup lang="ts">
import { onScopeDispose, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CommentItem from './CommentItem.vue'
import MarkdownEditor from '@/components/markdown/MarkdownEditor.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { useTaskComments } from '@/composables/useTaskComments'
import { MAX_COMMENT, validateComment } from '@/domain/comments'
import type { Task } from '@/domain/task'
import { useTasksStore } from '@/stores/tasks'
import { useToastsStore } from '@/stores/toasts'

/**
 * Pestaña «Comentarios» de la vista de tarea (step-18): caja para escribir arriba y los
 * comentarios debajo, del más reciente al más antiguo, con «Ver comentarios anteriores».
 */
const props = defineProps<{ task: Task }>()

const { t } = useI18n()
const tasksStore = useTasksStore()
const toasts = useToastsStore()

const { comments, loading, error, hasMore, more } = useTaskComments(() => props.task.id)

// Las fechas relativas («hace 5 minutos») se actualizan cada minuto.
const now = ref(Date.now())
const timer = setInterval(() => (now.value = Date.now()), 60_000)
onScopeDispose(() => clearInterval(timer))

// ---------------------------------------------------------------- nuevo
const writing = ref(false)
const draft = ref('')
const sending = ref(false)
const confirmDiscard = ref(false)

async function send(): Promise<void> {
  const problem = validateComment(draft.value)
  if (problem) {
    if (problem === 'tooLong') toasts.show(t('comments.tooLong', { max: MAX_COMMENT }), 'error')
    return
  }
  sending.value = true
  now.value = Date.now()
  try {
    await tasksStore.comment(props.task, draft.value)
    draft.value = ''
    writing.value = false
  } catch {
    toasts.show(t('comments.saveFailed'), 'error')
  } finally {
    sending.value = false
  }
}

function cancel(): void {
  if (draft.value.trim()) confirmDiscard.value = true
  else writing.value = false
}

function discard(): void {
  confirmDiscard.value = false
  draft.value = ''
  writing.value = false
}

// ---------------------------------------------------------------- borrar
const deletingId = ref<string | null>(null)
const deleteBusy = ref(false)

async function confirmDelete(): Promise<void> {
  if (!deletingId.value) return
  deleteBusy.value = true
  try {
    await tasksStore.removeComment(props.task, deletingId.value)
    toasts.show(t('comments.deleted'))
    deletingId.value = null
  } catch {
    toasts.show(t('comments.deleteFailed'), 'error')
  } finally {
    deleteBusy.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <MarkdownEditor
      v-if="writing"
      v-model="draft"
      :label="t('comments.label')"
      :placeholder="t('comments.placeholder')"
      :save-label="t('comments.send')"
      :max-length="MAX_COMMENT"
      :saving="sending"
      autofocus
      @save="send"
      @cancel="cancel"
    />
    <button
      v-else
      type="button"
      class="cursor-text rounded-lg border border-dashed border-gray-300 bg-transparent px-3 py-3 text-left font-text text-sm text-gray-500 transition hover:border-blue-500 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-gray-600 dark:text-gray-400 dark:hover:text-white"
      data-command="add-comment"
      @click="writing = true"
    >
      {{ t('comments.add') }}
    </button>

    <p v-if="error" class="m-0 font-text text-sm text-coral-700 dark:text-coral-500" role="alert">
      {{ t('comments.loadFailed') }}
    </p>
    <p
      v-else-if="loading && !comments.length"
      class="m-0 font-text text-sm text-gray-500 dark:text-gray-400"
    >
      {{ t('comments.loading') }}
    </p>
    <p v-else-if="!comments.length" class="m-0 font-text text-sm text-gray-500 dark:text-gray-400">
      {{ t('comments.empty') }}
    </p>

    <ul v-if="comments.length" class="m-0 flex list-none flex-col gap-4 p-0">
      <CommentItem
        v-for="comment in comments"
        :key="comment.id"
        :task="task"
        :comment="comment"
        :now="now"
        @delete="deletingId = comment.id"
      />
    </ul>

    <div v-if="hasMore">
      <BaseButton variant="ghost" :disabled="loading" @click="more">
        {{ t('comments.more') }}
      </BaseButton>
    </div>

    <ConfirmDialog
      :open="deletingId !== null"
      :title="t('comments.confirmDelete.title')"
      :message="t('comments.confirmDelete.message')"
      :confirm-label="t('comments.confirmDelete.confirm')"
      :cancel-label="t('common.cancel')"
      :busy="deleteBusy"
      @confirm="confirmDelete"
      @cancel="deletingId = null"
    />
    <ConfirmDialog
      :open="confirmDiscard"
      :title="t('comments.discard.title')"
      :message="t('comments.discard.message')"
      :confirm-label="t('comments.discard.confirm')"
      :cancel-label="t('comments.discard.cancel')"
      @confirm="discard"
      @cancel="confirmDiscard = false"
    />
  </div>
</template>
