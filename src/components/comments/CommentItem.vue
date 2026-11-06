<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Pencil, Trash2 } from 'lucide-vue-next'
import MarkdownEditor from '@/components/markdown/MarkdownEditor.vue'
import MarkdownView from '@/components/markdown/MarkdownView.vue'
import DropdownMenu, { type MenuItem } from '@/components/ui/DropdownMenu.vue'
import { MAX_COMMENT, normalizeCommentBody, validateComment, type Comment } from '@/domain/comments'
import type { Task } from '@/domain/task'
import { toggleChecklistLine } from '@/lib/markdown'
import { formatDateTime, formatRelative } from '@/lib/format'
import { useTasksStore } from '@/stores/tasks'
import { useToastsStore } from '@/stores/toasts'

/**
 * Un comentario (step-18): fecha relativa (la completa al pasar el ratón), marca «editado»,
 * texto en markdown y menú para editar o borrar. Marcar una casilla también es una edición.
 */
const props = defineProps<{ task: Task; comment: Comment; now: number }>()
const emit = defineEmits<{ delete: [] }>()

const { t } = useI18n()
const tasksStore = useTasksStore()
const toasts = useToastsStore()
/** Se incrementa para volver a pintar el texto si falla el guardado de una casilla. */
const renderKey = ref(0)

const editing = ref(false)
const draft = ref('')
const saving = ref(false)
const error = ref<string | null>(null)

const created = computed(() => formatRelative(props.comment.createdAtMs, props.now))
const createdTitle = computed(() =>
  t('comments.createdAt', { date: formatDateTime(props.comment.createdAtMs) }),
)
const editedTitle = computed(() =>
  t('comments.editedAt', { date: formatDateTime(props.comment.editedAtMs) }),
)

const menu = computed<MenuItem[]>(() => [
  { key: 'edit', label: t('comments.edit'), icon: Pencil },
  { key: 'delete', label: t('common.delete'), icon: Trash2, danger: true },
])

function onMenu(key: string): void {
  if (key === 'edit') {
    draft.value = props.comment.body
    error.value = null
    editing.value = true
  } else emit('delete')
}

async function save(): Promise<void> {
  const problem = validateComment(draft.value)
  if (problem) {
    error.value =
      problem === 'tooLong' ? t('comments.tooLong', { max: MAX_COMMENT }) : t('comments.saveFailed')
    return
  }
  if (normalizeCommentBody(draft.value) === props.comment.body) {
    editing.value = false
    return
  }
  saving.value = true
  try {
    await tasksStore.editCommentBody(props.task, props.comment.id, draft.value)
    editing.value = false
  } catch {
    error.value = t('comments.saveFailed')
  } finally {
    saving.value = false
  }
}

async function toggle(line: number): Promise<void> {
  const body = toggleChecklistLine(props.comment.body, line)
  if (body === props.comment.body) return
  try {
    await tasksStore.editCommentBody(props.task, props.comment.id, body)
  } catch {
    toasts.show(t('comments.saveFailed'), 'error')
    renderKey.value++ // la casilla vuelve a como está guardada
  }
}
</script>

<template>
  <li class="flex flex-col gap-1.5">
    <div class="flex items-center gap-2 font-text text-xs text-gray-500 dark:text-gray-400">
      <time
        :datetime="comment.createdAtMs ? new Date(comment.createdAtMs).toISOString() : undefined"
        :title="createdTitle"
      >
        {{ created }}
      </time>
      <span v-if="comment.editedAtMs" :title="editedTitle">· {{ t('comments.edited') }}</span>
      <DropdownMenu
        v-if="!editing"
        class="ml-auto"
        :label="t('comments.actions')"
        :items="menu"
        @select="onMenu"
      />
    </div>
    <MarkdownEditor
      v-if="editing"
      v-model="draft"
      :label="t('comments.label')"
      :max-length="MAX_COMMENT"
      :saving="saving"
      autofocus
      @save="save"
      @cancel="editing = false"
    />
    <div v-else class="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700">
      <MarkdownView :key="renderKey" :source="comment.body" @toggle="toggle" />
    </div>
    <p
      v-if="error"
      class="m-0 font-text text-sm font-medium text-coral-700 dark:text-coral-500"
      role="alert"
    >
      {{ error }}
    </p>
  </li>
</template>
