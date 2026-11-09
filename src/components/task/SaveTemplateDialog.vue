<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import { useTemplates } from '@/composables/useTemplates'
import { MAX_TEMPLATE_NAME, templateFromTask } from '@/domain/templates'
import type { Task } from '@/domain/task'
import { useToastsStore } from '@/stores/toasts'

/**
 * Guardar la tarea como plantilla (v1.1.0, D-10): se pide un nombre (por defecto, el título) y se
 * guardan título, descripción, prioridad, estimado, tags y los títulos de sus subtareas.
 */
const props = defineProps<{ open: boolean; task: Task | null; subtasks: Task[] }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const toasts = useToastsStore()
// Para guardar no hace falta escuchar la lista.
const { save } = useTemplates(() => false)
const name = ref('')
const busy = ref(false)

watch(
  () => props.open,
  (open) => {
    if (open) name.value = props.task?.title.slice(0, MAX_TEMPLATE_NAME) ?? ''
  },
)

async function submit(): Promise<void> {
  if (!props.task || busy.value) return
  busy.value = true
  try {
    const template = templateFromTask(
      props.task,
      name.value,
      props.subtasks.map((s) => s.title),
    )
    await save(template)
    toasts.show(t('templates.saved', { name: template.name }))
    emit('close')
  } catch {
    toasts.show(t('templates.failed'), 'error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <BaseDialog :open="open" :title="t('templates.saveTitle')" @close="emit('close')">
    <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <BaseInput
        v-model="name"
        :label="t('templates.name')"
        :help="t('templates.saveHelp', { n: subtasks.length })"
        :maxlength="MAX_TEMPLATE_NAME"
        autocomplete="off"
      />
      <div class="flex flex-wrap justify-end gap-3">
        <BaseButton variant="secondary" :disabled="busy" @click="emit('close')">
          {{ t('common.cancel') }}
        </BaseButton>
        <BaseButton type="submit" :disabled="busy">{{ t('templates.save') }}</BaseButton>
      </div>
    </form>
  </BaseDialog>
</template>
