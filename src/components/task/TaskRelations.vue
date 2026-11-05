<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Link2, Plus } from 'lucide-vue-next'
import LinkTaskForm from './LinkTaskForm.vue'
import RelatedTaskRow from './RelatedTaskRow.vue'
import { formatHours } from '@/domain/duration'
import { groupLinks, type SubtaskTotals } from '@/domain/links'
import type { Task, TaskLink } from '@/domain/task'
import { useTasksStore } from '@/stores/tasks'
import { useToastsStore } from '@/stores/toasts'

/**
 * Vínculos y subtareas de la vista de tarea (step-16, D-32, D-41). Los vínculos se ven en las
 * dos tareas; las subtareas son de un solo nivel, se crean aquí mismo y suman sus horas.
 */
const props = defineProps<{
  task: Task
  byId: Map<string, Task>
  parent: Task | null
  subtasks: Task[]
  totals: SubtaskTotals | null
  loading: boolean
}>()

const { t } = useI18n()
const tasksStore = useTasksStore()
const toasts = useToastsStore()

const linking = ref(false)
const groups = computed(() => groupLinks(props.task.links))
const keyOf = (id: string) => props.byId.get(id)?.key ?? '?'

async function unlink(link: TaskLink): Promise<void> {
  const key = keyOf(link.taskId)
  try {
    await tasksStore.unlink(props.task, link)
    toasts.show(t('relations.unlinked', { key }))
  } catch {
    toasts.show(t('relations.failed'), 'error')
  }
}

async function detach(taskId: string, key: string): Promise<void> {
  try {
    await tasksStore.setParent(taskId, null)
    toasts.show(t('subtasks.detached', { key }))
  } catch {
    toasts.show(t('relations.failed'), 'error')
  }
}

// ---------------------------------------------------------------- nueva subtarea
const newTitle = ref('')
const creating = ref(false)
async function createSubtask(): Promise<void> {
  const title = newTitle.value.trim()
  if (!title || creating.value) return
  creating.value = true
  try {
    const { key } = await tasksStore.create({
      title,
      projectId: props.task.projectId,
      startDate: null,
      endDate: null,
      priority: props.task.priority,
      parentId: props.task.id,
    })
    newTitle.value = ''
    toasts.show(t('subtasks.created', { key }))
  } catch {
    toasts.show(t('subtasks.createFailed'), 'error')
  } finally {
    creating.value = false
  }
}

const heading = 'm-0 font-text text-sm font-bold text-gray-800 dark:text-white'
const groupLabel =
  'm-0 px-2 font-text text-xs font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400'
const addButton =
  'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-transparent px-2 font-text text-sm font-bold text-blue-600 transition hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-blue-400 dark:hover:bg-gray-800'
</script>

<template>
  <!-- Vínculos -->
  <section class="flex flex-col gap-2">
    <div class="flex items-center gap-2">
      <h2 :class="heading">{{ t('relations.title') }}</h2>
      <button v-if="!linking" type="button" :class="[addButton, 'ml-auto']" @click="linking = true">
        <Link2 class="h-4 w-4" aria-hidden="true" />
        {{ t('relations.add') }}
      </button>
    </div>

    <LinkTaskForm
      v-if="linking"
      :task="task"
      :has-subtasks="subtasks.length > 0"
      @close="linking = false"
    />

    <div v-if="task.parentId" class="flex flex-col gap-0.5">
      <h3 :class="groupLabel">{{ t('relations.groups.parent') }}</h3>
      <ul class="m-0 list-none p-0">
        <RelatedTaskRow
          :task="parent"
          :loading="loading"
          :remove-label="t('subtasks.detachSelf')"
          @remove="detach(task.id, task.key)"
        />
      </ul>
    </div>

    <div v-for="group in groups" :key="group.type" class="flex flex-col gap-0.5">
      <h3 :class="groupLabel">{{ t(`relations.groups.${group.type}`) }}</h3>
      <ul class="m-0 list-none p-0">
        <RelatedTaskRow
          v-for="id in group.taskIds"
          :key="id"
          :task="byId.get(id) ?? null"
          :loading="loading"
          :remove-label="t('relations.remove', { key: keyOf(id) })"
          @remove="unlink({ type: group.type, taskId: id })"
        />
      </ul>
    </div>

    <p
      v-if="!task.parentId && !groups.length && !linking"
      class="m-0 font-text text-sm text-gray-500 dark:text-gray-400"
    >
      {{ t('relations.empty') }}
    </p>
  </section>

  <!-- Subtareas (un solo nivel: una subtarea no tiene esta sección) -->
  <section v-if="!task.parentId" class="flex flex-col gap-2">
    <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 :class="heading">{{ t('subtasks.title') }}</h2>
      <span
        v-if="totals && totals.count"
        class="font-text text-xs text-gray-500 dark:text-gray-400"
      >
        {{ t('subtasks.summary', { closed: totals.closed, count: totals.count }) }} ·
        {{ formatHours(totals.subtasksSpentMin) }}
      </span>
    </div>

    <ul v-if="subtasks.length" class="m-0 list-none p-0">
      <RelatedTaskRow
        v-for="sub in subtasks"
        :key="sub.id"
        :task="sub"
        show-hours
        :remove-label="t('subtasks.detach', { key: sub.key })"
        @remove="detach(sub.id, sub.key)"
      />
    </ul>

    <form class="flex items-center gap-2" @submit.prevent="createSubtask">
      <Plus class="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" aria-hidden="true" />
      <input
        v-model="newTitle"
        type="text"
        maxlength="200"
        :aria-label="t('subtasks.add')"
        :placeholder="t('subtasks.addPlaceholder')"
        :disabled="creating"
        class="h-9 min-w-0 flex-1 rounded-lg border-0 bg-transparent px-2 font-text text-sm text-gray-800 transition placeholder:text-gray-500 hover:bg-gray-100 focus:bg-gray-100 focus:outline-2 focus:outline-blue-500 dark:text-white dark:placeholder:text-gray-400 dark:hover:bg-gray-800 dark:focus:bg-gray-800"
      />
    </form>
  </section>
</template>
