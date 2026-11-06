<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Settings2 } from 'lucide-vue-next'
import TagChip from './TagChip.vue'
import { PROJECT_COLOR_CLASSES } from '@/domain/projects'
import {
  MAX_TAGS,
  MAX_TAGS_PER_TASK,
  MAX_TAG_NAME,
  findTagByName,
  nextTagColor,
  normalizeTagName,
  suggestTags,
  tagsOf,
  validateTagName,
  type Tag,
} from '@/domain/tags'
import { useTagsStore } from '@/stores/tags'
import { useToastsStore } from '@/stores/toasts'

/**
 * Selector de tags de una tarea con autocompletado (step-17, D-40). Se escribe para buscar;
 * si no existe, «Crear «nombre»» lo añade al catálogo con el color menos usado. Enter elige,
 * las flechas se mueven, Esc cierra y Retroceso con el campo vacío quita el último.
 */
const props = defineProps<{ modelValue: string[]; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [ids: string[]]; manage: [] }>()

const { t } = useI18n()
const tagsStore = useTagsStore()
const toasts = useToastsStore()
const id = useId()

const text = ref('')
const open = ref(false)
const active = ref(0)
const busy = ref(false)
const error = ref<string | null>(null)

const selected = computed(() => tagsOf(props.modelValue, tagsStore.all))
const full = computed(() => props.modelValue.length >= MAX_TAGS_PER_TASK)

type Option = { kind: 'tag'; tag: Tag } | { kind: 'create'; name: string }
const options = computed<Option[]>(() => {
  const list: Option[] = suggestTags(tagsStore.all, text.value, props.modelValue).map((tag) => ({
    kind: 'tag',
    tag,
  }))
  const name = normalizeTagName(text.value)
  if (
    name &&
    name.length <= MAX_TAG_NAME &&
    !findTagByName(tagsStore.all, name) &&
    tagsStore.all.length < MAX_TAGS
  )
    list.push({ kind: 'create', name })
  return list
})

watch(text, () => {
  active.value = 0
  error.value = null
  open.value = true
})

function set(ids: string[]): void {
  emit('update:modelValue', ids)
}

async function choose(option: Option): Promise<void> {
  if (full.value) {
    error.value = t('tags.max', { max: MAX_TAGS_PER_TASK })
    return
  }
  if (option.kind === 'tag') {
    set([...props.modelValue, option.tag.id])
    text.value = ''
    return
  }
  const problem = validateTagName(option.name, tagsStore.all)
  if (problem) {
    error.value = t(`tags.errors.${problem}`, { max: MAX_TAG_NAME })
    return
  }
  busy.value = true
  try {
    const newId = await tagsStore.create({ name: option.name, color: nextTagColor(tagsStore.all) })
    set([...props.modelValue, newId])
    toasts.show(t('tags.created', { name: option.name }))
    text.value = ''
  } catch {
    error.value = t('tags.saveFailed')
  } finally {
    busy.value = false
  }
}

function removeTag(tagId: string): void {
  set(props.modelValue.filter((v) => v !== tagId))
}

function onKeydown(event: KeyboardEvent): void {
  const count = options.value.length
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    open.value = true
    if (count) active.value = (active.value + 1) % count
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (count) active.value = (active.value - 1 + count) % count
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const option = open.value ? options.value[active.value] : undefined
    if (option) void choose(option)
  } else if (event.key === 'Escape') {
    if (open.value) {
      event.preventDefault()
      event.stopPropagation()
      open.value = false
    }
  } else if (event.key === 'Backspace' && !text.value && props.modelValue.length) {
    const last = selected.value.at(-1)
    if (last) removeTag(last.id)
  }
}

function optionId(index: number): string {
  return `${id}-option-${index}`
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <ul v-if="selected.length" class="m-0 flex list-none flex-wrap gap-1.5 p-0">
      <li v-for="tag in selected" :key="tag.id" class="min-w-0">
        <TagChip
          :tag="tag"
          :remove-label="disabled ? undefined : t('tags.remove', { name: tag.name })"
          @remove="removeTag(tag.id)"
        />
      </li>
    </ul>

    <div class="relative">
      <input
        v-model="text"
        type="text"
        role="combobox"
        autocomplete="off"
        :maxlength="MAX_TAG_NAME + 10"
        :disabled="disabled || busy"
        :aria-label="t('tags.add')"
        :aria-expanded="open && options.length > 0"
        :aria-controls="`${id}-list`"
        :aria-activedescendant="open && options.length ? optionId(active) : undefined"
        :placeholder="t('tags.placeholder')"
        class="h-10 w-full rounded-lg border-0 bg-gray-100 px-4 font-text text-sm text-gray-800 transition placeholder:text-gray-500 focus:outline-2 focus:outline-blue-500 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-400"
        @focus="open = true"
        @blur="open = false"
        @keydown="onKeydown"
      />
      <ul
        v-if="open && options.length"
        :id="`${id}-list`"
        role="listbox"
        class="absolute inset-x-0 top-full z-20 m-0 mt-1 flex max-h-64 list-none flex-col overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
      >
        <li
          v-for="(option, index) in options"
          :id="optionId(index)"
          :key="option.kind === 'tag' ? option.tag.id : 'create'"
          role="option"
          :aria-selected="index === active"
          :class="[
            'flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 font-text text-sm text-gray-800 dark:text-white',
            index === active ? 'bg-gray-100 dark:bg-gray-800' : '',
          ]"
          @mouseenter="active = index"
          @mousedown.prevent
          @click="choose(option)"
        >
          <template v-if="option.kind === 'tag'">
            <span
              :class="[
                'h-2 w-2 shrink-0 rounded-full',
                PROJECT_COLOR_CLASSES[option.tag.color]?.dot,
              ]"
              aria-hidden="true"
            />
            <span class="truncate">{{ option.tag.name }}</span>
          </template>
          <template v-else>
            <Plus class="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <span class="truncate font-bold text-blue-600 dark:text-blue-400">{{
              t('tags.create', { name: option.name })
            }}</span>
          </template>
        </li>
      </ul>
    </div>

    <p
      v-if="error"
      class="m-0 font-text text-sm font-medium text-coral-700 dark:text-coral-500"
      role="alert"
    >
      {{ error }}
    </p>

    <button
      type="button"
      class="inline-flex w-fit cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 font-text text-xs font-bold text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-blue-400"
      @click="emit('manage')"
    >
      <Settings2 class="h-3.5 w-3.5" aria-hidden="true" />
      {{ t('tags.manage') }}
    </button>
  </div>
</template>
