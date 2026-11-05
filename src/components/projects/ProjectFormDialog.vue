<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import FormMessage from '@/components/ui/FormMessage.vue'
import ProjectIcon from './ProjectIcon.vue'
import {
  PROJECT_COLORS,
  PROJECT_COLOR_CLASSES,
  PROJECT_ICONS,
  suggestKey,
  validateProject,
  type Project,
  type ProjectErrors,
} from '@/domain/projects'
import { useProjectsStore } from '@/stores/projects'

/** Crear o editar un proyecto. En edición la clave no se puede cambiar (D-12). */
const props = defineProps<{ open: boolean; project?: Project | null }>()
const emit = defineEmits<{ close: []; saved: [id: string] }>()

const { t } = useI18n()
const projectsStore = useProjectsStore()

const form = reactive({ name: '', key: '', color: 'blue', icon: 'folder' })
const keyTouched = ref(false)
const submitted = ref(false)
const busy = ref(false)
const failed = ref(false)

const isEdit = computed(() => !!props.project)
const otherKeys = computed(() => projectsStore.keys.filter((k) => k !== props.project?.key))

watch(
  () => props.open,
  (open) => {
    if (!open) return
    const p = props.project
    Object.assign(form, {
      name: p?.name ?? '',
      key: p?.key ?? '',
      color: p?.color ?? 'blue',
      icon: p?.icon ?? 'folder',
    })
    keyTouched.value = false
    submitted.value = false
    failed.value = false
  },
)

// Mientras no se toque a mano, la clave se propone a partir del nombre.
watch(
  () => form.name,
  (name) => {
    if (!isEdit.value && !keyTouched.value)
      form.key = name.trim() ? suggestKey(name, otherKeys.value) : ''
  },
)

function onKeyInput(value: string): void {
  keyTouched.value = true
  form.key = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6)
}

const errors = computed<ProjectErrors>(() =>
  submitted.value ? validateProject(form, otherKeys.value) : {},
)
const fieldError = (field: keyof ProjectErrors) => {
  const key = errors.value[field]
  return key ? t(key) : undefined
}

async function submit(): Promise<void> {
  submitted.value = true
  failed.value = false
  if (Object.keys(validateProject(form, otherKeys.value)).length > 0) return
  busy.value = true
  try {
    if (props.project) {
      await projectsStore.update(props.project.id, form)
      emit('saved', props.project.id)
    } else {
      emit('saved', await projectsStore.create(form))
    }
  } catch {
    failed.value = true
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <BaseDialog
    :open="open"
    :title="isEdit ? t('projects.form.editTitle') : t('projects.form.createTitle')"
    @close="emit('close')"
  >
    <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <BaseInput v-model="form.name" :label="t('projects.form.name')" :error="fieldError('name')" />
      <BaseInput
        :model-value="form.key"
        :label="t('projects.form.key')"
        :help="isEdit ? t('projects.form.keyLocked') : t('projects.form.keyHelp')"
        :error="fieldError('key')"
        :disabled="isEdit"
        @update:model-value="onKeyInput"
      />

      <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
        <legend class="mb-1 font-text text-sm font-medium text-gray-800 dark:text-white">
          {{ t('projects.form.color') }}
        </legend>
        <div class="flex flex-wrap gap-2">
          <label
            v-for="color in PROJECT_COLORS"
            :key="color"
            class="relative cursor-pointer"
            :title="t(`projects.colors.${color}`)"
          >
            <input
              v-model="form.color"
              type="radio"
              name="project-color"
              :value="color"
              class="peer sr-only"
            />
            <span
              :class="[
                'block h-8 w-8 rounded-full transition peer-checked:outline-2 peer-checked:outline-offset-2 peer-checked:outline-gray-800 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-600 dark:peer-checked:outline-white',
                PROJECT_COLOR_CLASSES[color].dot,
              ]"
            />
            <span class="sr-only">{{ t(`projects.colors.${color}`) }}</span>
          </label>
        </div>
      </fieldset>

      <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
        <legend class="mb-1 font-text text-sm font-medium text-gray-800 dark:text-white">
          {{ t('projects.form.icon') }}
        </legend>
        <div class="grid grid-cols-6 gap-2">
          <label v-for="icon in PROJECT_ICONS" :key="icon" class="cursor-pointer" :title="icon">
            <input
              v-model="form.icon"
              type="radio"
              name="project-icon"
              :value="icon"
              class="peer sr-only"
            />
            <span
              class="flex h-10 items-center justify-center rounded-lg bg-gray-100 text-gray-800 transition peer-checked:bg-blue-500 peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-blue-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 dark:peer-checked:bg-blue-500"
            >
              <ProjectIcon :name="icon" class="h-5 w-5" />
            </span>
            <span class="sr-only">{{ icon }}</span>
          </label>
        </div>
      </fieldset>

      <FormMessage v-if="failed" tone="error">{{ t('projects.form.failed') }}</FormMessage>

      <div class="flex flex-wrap justify-end gap-3">
        <BaseButton variant="secondary" :disabled="busy" @click="emit('close')">
          {{ t('common.cancel') }}
        </BaseButton>
        <BaseButton type="submit" :disabled="busy">
          {{ isEdit ? t('common.save') : t('projects.form.create') }}
        </BaseButton>
      </div>
    </form>
  </BaseDialog>
</template>
