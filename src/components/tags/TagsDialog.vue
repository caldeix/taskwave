<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Trash2 } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { PROJECT_COLOR_CLASSES, type ProjectColor } from '@/domain/projects'
import {
  MAX_TAGS,
  MAX_TAG_NAME,
  TAG_COLORS,
  nextTagColor,
  normalizeTagName,
  validateTagName,
  type Tag,
} from '@/domain/tags'
import { useTagsStore } from '@/stores/tags'
import { useToastsStore } from '@/stores/toasts'

/**
 * Catálogo de tags (step-17, D-40): crear, renombrar, cambiar el color y borrar. Cada cambio se
 * guarda al momento; como las tareas guardan solo el id, se ve en todas sus tareas a la vez.
 */
defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const tagsStore = useTagsStore()
const toasts = useToastsStore()

// ---------------------------------------------------------------- nuevo
const newName = ref('')
const newError = ref<string | null>(null)
const creating = ref(false)

function errorText(code: string): string {
  return t(`tags.errors.${code}`, { max: MAX_TAG_NAME })
}

async function create(): Promise<void> {
  const problem = validateTagName(newName.value, tagsStore.all)
  if (problem) {
    newError.value = errorText(problem)
    return
  }
  creating.value = true
  try {
    const name = normalizeTagName(newName.value)
    await tagsStore.create({ name, color: nextTagColor(tagsStore.all) })
    newName.value = ''
    newError.value = null
  } catch {
    newError.value = t('tags.saveFailed')
  } finally {
    creating.value = false
  }
}

// ---------------------------------------------------------------- editar
const rowErrors = reactive<Record<string, string>>({})

async function rename(tag: Tag, event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const name = normalizeTagName(input.value)
  if (name === tag.name) {
    input.value = tag.name
    delete rowErrors[tag.id]
    return
  }
  const problem = validateTagName(name, tagsStore.all, tag.id)
  if (problem) {
    rowErrors[tag.id] = errorText(problem)
    return
  }
  delete rowErrors[tag.id]
  try {
    await tagsStore.update(tag.id, { name })
    input.value = name
  } catch {
    rowErrors[tag.id] = t('tags.saveFailed')
  }
}

function resetName(tag: Tag, event: Event): void {
  ;(event.target as HTMLInputElement).value = tag.name
  delete rowErrors[tag.id]
}

async function recolor(tag: Tag, color: string): Promise<void> {
  try {
    await tagsStore.update(tag.id, { color: color as ProjectColor })
  } catch {
    rowErrors[tag.id] = t('tags.saveFailed')
  }
}

// ---------------------------------------------------------------- borrar
const deleting = ref<{ tag: Tag; count: number } | null>(null)
const deleteBusy = ref(false)

async function askDelete(tag: Tag): Promise<void> {
  try {
    deleting.value = { tag, count: await tagsStore.countTasks(tag.id) }
  } catch {
    toasts.show(t('tags.saveFailed'), 'error')
  }
}

async function confirmDelete(): Promise<void> {
  if (!deleting.value) return
  const { tag } = deleting.value
  deleteBusy.value = true
  try {
    await tagsStore.remove(tag.id)
    toasts.show(t('tags.deleted', { name: tag.name }))
    deleting.value = null
  } catch {
    toasts.show(t('tags.saveFailed'), 'error')
  } finally {
    deleteBusy.value = false
  }
}

const field =
  'h-9 w-full min-w-0 rounded-lg border-0 bg-gray-100 px-3 font-text text-sm text-gray-800 transition placeholder:text-gray-500 focus:outline-2 focus:outline-blue-500 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-400'
</script>

<template>
  <BaseDialog :open="open" :title="t('tags.dialog.title')" @close="emit('close')">
    <p class="m-0 font-text text-sm text-gray-500 dark:text-gray-400">
      {{ t('tags.dialog.intro') }}
    </p>

    <form class="flex flex-col gap-1" @submit.prevent="create">
      <label class="font-text text-sm font-medium text-gray-800 dark:text-white" for="new-tag">
        {{ t('tags.dialog.newLabel') }}
      </label>
      <div class="flex gap-2">
        <input
          id="new-tag"
          v-model="newName"
          type="text"
          autocomplete="off"
          :maxlength="MAX_TAG_NAME + 10"
          :placeholder="t('tags.dialog.newPlaceholder')"
          :disabled="tagsStore.all.length >= MAX_TAGS"
          :aria-invalid="newError ? 'true' : undefined"
          :class="field"
          @input="newError = null"
        />
        <BaseButton type="submit" :disabled="creating || tagsStore.all.length >= MAX_TAGS">
          {{ t('tags.dialog.add') }}
        </BaseButton>
      </div>
      <p
        v-if="newError"
        class="m-0 font-text text-sm font-medium text-coral-700 dark:text-coral-500"
        role="alert"
      >
        {{ newError }}
      </p>
      <p
        v-else-if="tagsStore.all.length >= MAX_TAGS"
        class="m-0 font-text text-sm text-gray-500 dark:text-gray-400"
      >
        {{ t('tags.dialog.limit', { max: MAX_TAGS }) }}
      </p>
    </form>

    <ul v-if="tagsStore.sorted.length" class="m-0 flex list-none flex-col gap-2 p-0">
      <li v-for="tag in tagsStore.sorted" :key="tag.id" class="flex flex-col gap-1">
        <div class="flex items-center gap-2">
          <span
            :class="['h-3 w-3 shrink-0 rounded-full', PROJECT_COLOR_CLASSES[tag.color]?.dot]"
            aria-hidden="true"
          />
          <input
            type="text"
            autocomplete="off"
            :value="tag.name"
            :maxlength="MAX_TAG_NAME + 10"
            :aria-label="t('tags.dialog.name', { name: tag.name })"
            :aria-invalid="rowErrors[tag.id] ? 'true' : undefined"
            :class="field"
            @change="rename(tag, $event)"
            @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
            @keydown.esc.stop.prevent="resetName(tag, $event)"
          />
          <select
            :value="tag.color"
            :aria-label="t('tags.dialog.color', { name: tag.name })"
            class="h-9 w-28 shrink-0 cursor-pointer rounded-lg border-0 bg-gray-100 px-2 font-text text-sm text-gray-800 focus:outline-2 focus:outline-blue-500 dark:bg-gray-800 dark:text-white"
            @change="recolor(tag, ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="color in TAG_COLORS" :key="color" :value="color">
              {{ t(`projects.colors.${color}`) }}
            </option>
          </select>
          <button
            type="button"
            class="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-gray-500 transition hover:bg-gray-200 hover:text-coral-700 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-coral-500"
            :aria-label="t('tags.dialog.delete', { name: tag.name })"
            :title="t('tags.dialog.delete', { name: tag.name })"
            @click="askDelete(tag)"
          >
            <Trash2 class="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p
          v-if="rowErrors[tag.id]"
          class="m-0 pl-5 font-text text-sm font-medium text-coral-700 dark:text-coral-500"
          role="alert"
        >
          {{ rowErrors[tag.id] }}
        </p>
      </li>
    </ul>
    <p v-else class="m-0 font-text text-sm text-gray-500 dark:text-gray-400">
      {{ t('tags.dialog.empty') }}
    </p>

    <div class="flex justify-end">
      <BaseButton variant="secondary" @click="emit('close')">
        {{ t('tags.dialog.close') }}
      </BaseButton>
    </div>

    <ConfirmDialog
      :open="deleting !== null"
      :title="t('tags.confirmDelete.title')"
      :message="
        deleting
          ? deleting.count
            ? t(
                'tags.confirmDelete.message',
                { name: deleting.tag.name, count: deleting.count },
                deleting.count,
              )
            : t('tags.confirmDelete.messageNone', { name: deleting.tag.name })
          : ''
      "
      :confirm-label="t('tags.confirmDelete.confirm')"
      :cancel-label="t('common.cancel')"
      :busy="deleteBusy"
      @confirm="confirmDelete"
      @cancel="deleting = null"
    />
  </BaseDialog>
</template>
