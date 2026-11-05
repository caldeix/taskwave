<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Pencil } from 'lucide-vue-next'
import MarkdownEditor from '@/components/markdown/MarkdownEditor.vue'
import MarkdownView from '@/components/markdown/MarkdownView.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import type { Task } from '@/domain/task'
import { toggleChecklistLine } from '@/lib/markdown'
import { useTasksStore } from '@/stores/tasks'
import { useToastsStore } from '@/stores/toasts'

/**
 * Descripción de la tarea en markdown (step-15, D-43). Se lee formateada; con el lápiz (o
 * pulsando el texto vacío) se abre el editor. Las casillas de las checklists se marcan sin
 * entrar a editar y se guardan al momento.
 */
const props = defineProps<{ task: Task }>()

const { t } = useI18n()
const tasksStore = useTasksStore()
const toasts = useToastsStore()

const editing = ref(false)
const draft = ref('')
const saving = ref(false)
const confirmDiscard = ref(false)
/** Se incrementa para volver a pintar el HTML si falla el guardado de una casilla. */
const renderKey = ref(0)

function startEditing(): void {
  draft.value = props.task.description
  editing.value = true
}

async function save(): Promise<void> {
  const description = draft.value.replace(/\s+$/, '')
  if (description === props.task.description) {
    editing.value = false
    return
  }
  saving.value = true
  try {
    await tasksStore.updateFields(props.task, { description })
    editing.value = false
  } catch {
    toasts.show(t('taskView.saveFailed'), 'error')
  } finally {
    saving.value = false
  }
}

function cancel(): void {
  if (draft.value !== props.task.description) confirmDiscard.value = true
  else editing.value = false
}

function discard(): void {
  confirmDiscard.value = false
  editing.value = false
}

async function toggle(line: number): Promise<void> {
  const description = toggleChecklistLine(props.task.description, line)
  if (description === props.task.description) return
  try {
    await tasksStore.updateFields(props.task, { description })
  } catch {
    toasts.show(t('taskView.saveFailed'), 'error')
    renderKey.value++ // la casilla vuelve a como está guardada
  }
}
</script>

<template>
  <section class="flex flex-col gap-2">
    <div class="flex items-center gap-2">
      <h2 class="m-0 font-text text-sm font-bold text-gray-800 dark:text-white">
        {{ t('taskView.description') }}
      </h2>
      <button
        v-if="!editing && task.description"
        type="button"
        class="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-gray-500 transition hover:bg-gray-200 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
        :aria-label="t('taskView.editDescription')"
        :title="t('taskView.editDescription')"
        @click="startEditing"
      >
        <Pencil class="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>

    <MarkdownEditor
      v-if="editing"
      v-model="draft"
      :label="t('taskView.descriptionLabel')"
      :placeholder="t('taskView.descriptionPlaceholder')"
      :saving="saving"
      autofocus
      @save="save"
      @cancel="cancel"
    />
    <MarkdownView
      v-else-if="task.description"
      :key="renderKey"
      :source="task.description"
      @toggle="toggle"
    />
    <button
      v-else
      type="button"
      class="cursor-text rounded-lg border border-dashed border-gray-300 bg-transparent px-3 py-4 text-left font-text text-sm text-gray-500 transition hover:border-blue-500 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-gray-600 dark:text-gray-400 dark:hover:text-white"
      @click="startEditing"
    >
      {{ t('taskView.noDescription') }}
    </button>

    <ConfirmDialog
      :open="confirmDiscard"
      :title="t('taskView.discardDescription.title')"
      :message="t('taskView.discardDescription.message')"
      :confirm-label="t('taskView.discardDescription.confirm')"
      :cancel-label="t('taskView.discardDescription.cancel')"
      @confirm="discard"
      @cancel="confirmDiscard = false"
    />
  </section>
</template>
