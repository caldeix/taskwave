<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import FormMessage from '@/components/ui/FormMessage.vue'
import { useTemplates } from '@/composables/useTemplates'
import { PRIORITIES, type Priority } from '@/domain/task'
import { inputFromTemplate, subtaskInputs } from '@/domain/templates'
import { validateNewTask, type NewTaskErrors } from '@/domain/taskCreate'
import { useProjectsStore } from '@/stores/projects'
import { useTasksStore } from '@/stores/tasks'
import { useToastsStore } from '@/stores/toasts'

/**
 * Alta de una tarea (step-10): título, proyecto (o «Sin proyecto», D-11), fechas opcionales
 * (D-19) y prioridad (D-51). Nace Pendiente (D-15) con su clave (D-12).
 * El calendario (step-11) la abrirá con el día pulsado ya puesto. Desde la v1.1.0 se puede partir
 * de una plantilla (D-10): rellena título y prioridad y añade descripción, estimado, tags y subtareas.
 */
const props = defineProps<{
  open: boolean
  /** Proyecto preseleccionado (`null` = sin proyecto). */
  projectId: string | null
  startDate: string | null
  /** Título ya escrito (p. ej. desde el alta rápida del calendario). */
  title?: string
}>()
const emit = defineEmits<{ close: []; created: [id: string] }>()

const { t } = useI18n()
const projectsStore = useProjectsStore()
const tasksStore = useTasksStore()
const toasts = useToastsStore()

const NO_PROJECT = ''
const { templates } = useTemplates(() => props.open)
const templateId = ref('')
const template = computed(() => templates.value.find((x) => x.id === templateId.value))

function applyTemplate(id: string): void {
  templateId.value = id
  const chosen = templates.value.find((x) => x.id === id)
  if (!chosen) return
  form.title = chosen.title
  form.priority = chosen.priority
}
const form = reactive({
  title: '',
  projectId: NO_PROJECT,
  startDate: '',
  endDate: '',
  priority: 'medium' as Priority,
})
const submitted = ref(false)
const busy = ref(false)
const failed = ref(false)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    Object.assign(form, {
      title: props.title ?? '',
      projectId: props.projectId ?? NO_PROJECT,
      startDate: props.startDate ?? '',
      endDate: '',
      priority: 'medium',
    })
    templateId.value = ''
    submitted.value = false
    failed.value = false
  },
)

const payload = computed(() => ({
  title: form.title,
  projectId: form.projectId || null,
  startDate: form.startDate || null,
  endDate: form.endDate || null,
  priority: form.priority,
}))

const errors = computed<NewTaskErrors>(() =>
  submitted.value ? validateNewTask(payload.value) : {},
)
const fieldError = (field: keyof NewTaskErrors) => {
  const key = errors.value[field]
  return key ? t(key) : undefined
}

async function submit(): Promise<void> {
  submitted.value = true
  failed.value = false
  if (Object.keys(validateNewTask(payload.value)).length > 0) return
  busy.value = true
  try {
    const chosen = template.value
    const created = await tasksStore.create(
      chosen ? inputFromTemplate(chosen, payload.value) : payload.value,
    )
    // Las subtareas de la plantilla, debajo de la nueva (una detrás de otra por las claves).
    if (chosen)
      for (const sub of subtaskInputs(chosen, { id: created.id, ...payload.value }))
        await tasksStore.create(sub)
    toasts.show(t('tasks.created', { key: created.key }))
    emit('created', created.id)
  } catch {
    failed.value = true
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <BaseDialog :open="open" :title="t('tasks.new.title')" @close="emit('close')">
    <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <BaseSelect
        v-if="templates.length"
        :model-value="templateId"
        :label="t('templates.use')"
        @update:model-value="applyTemplate"
      >
        <option value="">{{ t('templates.none') }}</option>
        <option v-for="x in templates" :key="x.id" :value="x.id">{{ x.name }}</option>
      </BaseSelect>
      <BaseInput
        v-model="form.title"
        :label="t('tasks.fields.title')"
        :error="fieldError('title')"
        autocomplete="off"
      />
      <BaseSelect v-model="form.projectId" :label="t('tasks.fields.project')">
        <option :value="NO_PROJECT">{{ t('nav.inbox') }}</option>
        <option v-for="project in projectsStore.active" :key="project.id" :value="project.id">
          {{ project.name }} ({{ project.key }})
        </option>
      </BaseSelect>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <BaseInput
          v-model="form.startDate"
          type="date"
          :label="t('tasks.fields.startDate')"
          :help="t('tasks.new.dateOptional')"
          :error="fieldError('startDate')"
        />
        <BaseInput
          v-model="form.endDate"
          type="date"
          :label="t('tasks.fields.endDate')"
          :error="fieldError('endDate')"
        />
      </div>
      <BaseSelect v-model="form.priority" :label="t('tasks.fields.priority')">
        <option v-for="p in PRIORITIES" :key="p" :value="p">{{ t(`tasks.priority.${p}`) }}</option>
      </BaseSelect>

      <FormMessage v-if="failed" tone="error">{{ t('tasks.new.failed') }}</FormMessage>

      <div class="flex flex-wrap justify-end gap-3">
        <BaseButton variant="secondary" :disabled="busy" @click="emit('close')">
          {{ t('common.cancel') }}
        </BaseButton>
        <BaseButton type="submit" :disabled="busy">{{ t('tasks.new.submit') }}</BaseButton>
      </div>
    </form>
  </BaseDialog>
</template>
