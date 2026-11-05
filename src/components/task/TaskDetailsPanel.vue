<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ExternalLink, Link2, Plus, X } from 'lucide-vue-next'
import HoursBar from './HoursBar.vue'
import StatusSelect from './StatusSelect.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import FormMessage from '@/components/ui/FormMessage.vue'
import { formatDuration, parseDuration } from '@/domain/duration'
import { normalizeDates, validateDates, validateWebLink } from '@/domain/taskEdit'
import type { TaskStatus } from '@/domain/status'
import { PRIORITIES, type Priority, type Task } from '@/domain/task'
import { formatDateTime } from '@/lib/format'
import { useProfileStore } from '@/stores/profile'
import { useProjectsStore } from '@/stores/projects'
import { useTasksStore } from '@/stores/tasks'
import { useToastsStore } from '@/stores/toasts'

/**
 * Panel derecho de la vista de tarea (step-14): estado, prioridad, proyecto, fechas, estimado,
 * horas, enlaces y fechas de alta. Cada campo se guarda solo al cambiarlo (D-46).
 */
const props = defineProps<{ task: Task }>()
const emit = defineEmits<{ moveProject: [projectId: string | null] }>()

const { t } = useI18n()
const tasksStore = useTasksStore()
const projectsStore = useProjectsStore()
const profileStore = useProfileStore()
const toasts = useToastsStore()

const saving = ref(false)
const savedAt = ref<number | null>(null)
const hoursPerDay = computed(() => profileStore.prefs.hoursPerDay)

async function save(action: () => Promise<unknown>): Promise<boolean> {
  saving.value = true
  try {
    await action()
    savedAt.value = Date.now()
    return true
  } catch {
    toasts.show(t('taskView.saveFailed'), 'error')
    return false
  } finally {
    saving.value = false
  }
}

// ---- Estado y prioridad ----
function setStatus(status: TaskStatus): void {
  void save(() => tasksStore.setStatus(props.task, status))
}
function setPriority(priority: string): void {
  if (priority !== props.task.priority)
    void save(() => tasksStore.updateFields(props.task, { priority: priority as Priority }))
}

// ---- Proyecto (cambia la clave, D-12) ----
const NO_PROJECT = ''
const projectOptions = computed(() => {
  const list = [...projectsStore.active]
  const current = props.task.projectId ? projectsStore.byId(props.task.projectId) : undefined
  if (current?.archived) list.push(current)
  return list
})
/**
 * Mover de proyecto lo hace la vista (`moveProject`): al cambiar la clave, la consulta por la
 * clave antigua se vacía y este panel puede desmontarse antes de terminar.
 */
function setProject(value: string): void {
  const target = value || null
  if (target !== props.task.projectId) emit('moveProject', target)
}

// ---- Fechas ----
const startInput = ref('')
const endInput = ref('')
const dateError = ref<string | null>(null)
watch(
  () => [props.task.startDate, props.task.endDate],
  () => {
    startInput.value = props.task.startDate ?? ''
    endInput.value = props.task.endDate ?? ''
  },
  { immediate: true },
)
function saveDates(): void {
  const start = startInput.value || null
  const end = endInput.value || null
  dateError.value = validateDates(start, end)
  if (dateError.value) return
  const dates = normalizeDates(start, end)
  if (dates.startDate === props.task.startDate && dates.endDate === props.task.endDate) return
  void save(() => tasksStore.setDates(props.task, dates))
}

// ---- Estimado (1d 2h 30m) ----
const estimateInput = ref('')
const estimateError = ref<string | null>(null)
watch(
  () => [props.task.estimateMin, hoursPerDay.value],
  () => {
    estimateInput.value =
      props.task.estimateMin !== null
        ? formatDuration(props.task.estimateMin, hoursPerDay.value)
        : ''
  },
  { immediate: true },
)
function saveEstimate(): void {
  const text = estimateInput.value.trim()
  const minutes = text ? parseDuration(text, hoursPerDay.value) : null
  estimateError.value = text && minutes === null ? 'taskView.estimateInvalid' : null
  if (estimateError.value || minutes === props.task.estimateMin) return
  void save(() => tasksStore.updateFields(props.task, { estimateMin: minutes }))
}

// ---- Enlaces (D-45) ----
const newUrl = ref('')
const newTitle = ref('')
const linkError = ref<string | null>(null)
function addLink(): void {
  const result = validateWebLink(newUrl.value, newTitle.value, props.task.weblinks)
  if ('error' in result) {
    linkError.value = result.error
    return
  }
  linkError.value = null
  void save(() =>
    tasksStore.updateFields(props.task, { weblinks: [...props.task.weblinks, result.link] }),
  ).then((ok) => {
    if (ok) {
      newUrl.value = ''
      newTitle.value = ''
    }
  })
}
function removeLink(url: string): void {
  void save(() =>
    tasksStore.updateFields(props.task, {
      weblinks: props.task.weblinks.filter((l) => l.url !== url),
    }),
  )
}

const label =
  'mb-1 block font-text text-xs font-bold tracking-wider text-gray-500 uppercase dark:text-gray-400'
</script>

<template>
  <aside class="flex min-w-0 flex-col gap-5" :aria-label="t('taskView.details')">
    <p
      class="m-0 h-4 font-text text-xs text-gray-500 dark:text-gray-400"
      role="status"
      aria-live="polite"
    >
      <template v-if="saving">{{ t('taskView.saving') }}</template>
      <template v-else-if="savedAt">{{ t('taskView.saved') }}</template>
    </p>

    <div>
      <span :class="label">{{ t('taskView.status') }}</span>
      <StatusSelect :status="task.status" :disabled="saving" @change="setStatus" />
    </div>

    <BaseSelect
      :model-value="task.priority"
      :label="t('tasks.fields.priority')"
      @update:model-value="setPriority"
    >
      <option v-for="p in PRIORITIES" :key="p" :value="p">{{ t(`tasks.priority.${p}`) }}</option>
    </BaseSelect>

    <div class="flex flex-col gap-1">
      <BaseSelect
        :model-value="task.projectId ?? NO_PROJECT"
        :label="t('tasks.fields.project')"
        :disabled="saving"
        @update:model-value="setProject"
      >
        <option :value="NO_PROJECT">{{ t('nav.inbox') }}</option>
        <option v-for="project in projectOptions" :key="project.id" :value="project.id">
          {{ project.name }} ({{ project.key }})
        </option>
      </BaseSelect>
      <p class="m-0 font-text text-xs text-gray-500 dark:text-gray-400">
        {{ t('taskView.projectHelp') }}
      </p>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <BaseInput
        v-model="startInput"
        type="date"
        :label="t('tasks.fields.startDate')"
        @change="saveDates"
      />
      <BaseInput
        v-model="endInput"
        type="date"
        :label="t('tasks.fields.endDate')"
        @change="saveDates"
      />
    </div>
    <FormMessage v-if="dateError" tone="error">{{ t(dateError) }}</FormMessage>

    <div class="flex flex-col gap-3">
      <BaseInput
        v-model="estimateInput"
        :label="t('taskView.estimate')"
        :help="t('taskView.estimateHelp', { hours: hoursPerDay })"
        :error="estimateError ? t(estimateError) : undefined"
        placeholder="1d 2h 30m"
        autocomplete="off"
        @change="saveEstimate"
        @keydown.enter.prevent="saveEstimate"
      />
      <div>
        <span :class="label">{{ t('taskView.spent') }}</span>
        <HoursBar :spent-min="task.spentMin" :estimate-min="task.estimateMin" />
      </div>
    </div>

    <!-- Enlaces (D-45) -->
    <section class="flex flex-col gap-2">
      <span :class="label">{{ t('taskView.links.title') }}</span>
      <ul v-if="task.weblinks.length" class="m-0 flex list-none flex-col gap-1 p-0">
        <li v-for="link in task.weblinks" :key="link.url" class="flex min-w-0 items-center gap-2">
          <Link2 class="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" aria-hidden="true" />
          <a
            :href="link.url"
            target="_blank"
            rel="noopener noreferrer nofollow"
            :title="link.url"
            class="min-w-0 flex-1 truncate font-text text-sm font-medium text-blue-600 no-underline hover:underline dark:text-blue-400"
          >
            {{ link.title }}
            <ExternalLink class="inline h-3 w-3" aria-hidden="true" />
          </a>
          <button
            type="button"
            class="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-gray-500 transition hover:bg-gray-200 hover:text-coral-700 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-coral-500"
            :aria-label="t('taskView.links.remove', { title: link.title })"
            :disabled="saving"
            @click="removeLink(link.url)"
          >
            <X class="h-4 w-4" aria-hidden="true" />
          </button>
        </li>
      </ul>
      <form class="flex flex-col gap-2" novalidate @submit.prevent="addLink">
        <input
          v-model="newUrl"
          type="url"
          :placeholder="t('taskView.links.urlPlaceholder')"
          :aria-label="t('taskView.links.url')"
          class="h-9 w-full rounded-lg border-0 bg-gray-100 px-3 font-text text-sm text-gray-800 placeholder:text-gray-500 focus:outline-2 focus:outline-blue-500 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-400"
        />
        <div class="flex gap-2">
          <input
            v-model="newTitle"
            type="text"
            maxlength="100"
            :placeholder="t('taskView.links.titlePlaceholder')"
            :aria-label="t('taskView.links.linkTitle')"
            class="h-9 min-w-0 flex-1 rounded-lg border-0 bg-gray-100 px-3 font-text text-sm text-gray-800 placeholder:text-gray-500 focus:outline-2 focus:outline-blue-500 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-400"
          />
          <button
            type="submit"
            class="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-lg border-0 bg-gray-200 px-3 font-text text-sm font-bold text-gray-800 transition hover:bg-gray-300 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
            :disabled="!newUrl.trim() || saving"
          >
            <Plus class="h-4 w-4" aria-hidden="true" />
            {{ t('taskView.links.add') }}
          </button>
        </div>
        <FormMessage v-if="linkError" tone="error">{{ t(linkError) }}</FormMessage>
      </form>
    </section>

    <dl
      class="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-text text-xs text-gray-500 dark:text-gray-400"
    >
      <dt>{{ t('taskView.created') }}</dt>
      <dd class="m-0">{{ formatDateTime(task.createdAtMs) }}</dd>
      <dt>{{ t('taskView.updated') }}</dt>
      <dd class="m-0">{{ formatDateTime(task.updatedAtMs) }}</dd>
      <template v-if="task.resolvedAtMs">
        <dt>{{ t('taskView.resolved') }}</dt>
        <dd class="m-0">{{ formatDateTime(task.resolvedAtMs) }}</dd>
      </template>
    </dl>
  </aside>
</template>
