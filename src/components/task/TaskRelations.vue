<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Link2 } from 'lucide-vue-next'
import LinkTaskForm from './LinkTaskForm.vue'
import RelatedTaskRow from './RelatedTaskRow.vue'
import SubtaskInput from './SubtaskInput.vue'
import { countSubtasks } from '@/data/taskQueries'
import { formatHours } from '@/domain/duration'
import {
  MAX_LINKS,
  checkRelationChange,
  groupLinks,
  type RelationKind,
  type SubtaskTotals,
} from '@/domain/links'
import type { TaskStatus } from '@/domain/status'
import type { Task, TaskLink } from '@/domain/task'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/stores/auth'
import { useTasksStore } from '@/stores/tasks'
import { useToastsStore } from '@/stores/toasts'

/**
 * Vínculos y subtareas de la vista de tarea (step-16, D-32, D-41). Los vínculos se ven en las
 * dos tareas; las subtareas son de un solo nivel, se crean aquí mismo y suman sus horas.
 * Desde la v1.0.2, el tipo de cada relación se cambia en su fila, «Sin vínculos» abre el
 * buscador y el alta de subtareas propone también tareas existentes.
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
const authStore = useAuthStore()
const tasksStore = useTasksStore()
const toasts = useToastsStore()

const linking = ref(false)
const subtaskInput = ref<InstanceType<typeof SubtaskInput> | null>(null)

/** Para la paleta de comandos (v1.1.0): abrir el buscador de vínculos o ir a «Nueva subtarea». */
defineExpose({
  startLinking: () => (linking.value = true),
  focusSubtask: () => subtaskInput.value?.focus(),
})
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

// ------------------------------------------------- cambiar el tipo de una relación
/** Id de la tarea cuya relación se está guardando. */
const changing = ref<string | null>(null)

async function changeKind(
  target: Task | null,
  from: RelationKind,
  to: RelationKind,
): Promise<void> {
  const uid = authStore.user?.uid
  if (!target || !uid || changing.value) return
  changing.value = target.id
  try {
    // Para que `target` pase a ser subtarea hay que saber si tiene subtareas.
    const targetSubtasks = to === 'child' ? await countSubtasks(db, uid, target.id) : 0
    const problem = checkRelationChange(
      props.task,
      target,
      from,
      to,
      props.subtasks.length,
      targetSubtasks,
    )
    if (problem) {
      toasts.show(t(`relations.errors.${problem}`, { key: target.key, max: MAX_LINKS }), 'error')
      return
    }
    await tasksStore.changeRelationKind(props.task, target.id, from, to)
    toasts.show(t('relations.changed', { key: target.key, kind: t(`relations.kinds.${to}`) }))
  } catch {
    toasts.show(t('relations.failed'), 'error')
  } finally {
    changing.value = null
  }
}

// ------------------------------------------------- estado de una tarea relacionada
/** Id de la tarea relacionada cuyo estado se está guardando. */
const savingStatus = ref<string | null>(null)

async function changeStatus(target: Task | null, status: TaskStatus): Promise<void> {
  if (!target || savingStatus.value) return
  savingStatus.value = target.id
  try {
    await tasksStore.setStatus(target, status)
    toasts.show(t('relations.statusChanged', { key: target.key, status: t(`status.${status}`) }))
  } catch (error) {
    // Si se cancela el aviso del cronómetro al cerrar, no es un error.
    if (!(error instanceof Error && error.message === 'timer-stop-failed'))
      toasts.show(t('taskView.saveFailed'), 'error')
  } finally {
    savingStatus.value = null
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
          kind="parent"
          :busy="changing === task.parentId"
          :remove-label="t('subtasks.detachSelf')"
          :status-busy="savingStatus === task.parentId"
          @remove="detach(task.id, task.key)"
          @change-kind="changeKind(parent, 'parent', $event)"
          @change-status="changeStatus(parent, $event)"
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
          :kind="group.type"
          :busy="changing === id"
          :remove-label="t('relations.remove', { key: keyOf(id) })"
          :status-busy="savingStatus === id"
          @remove="unlink({ type: group.type, taskId: id })"
          @change-kind="changeKind(byId.get(id) ?? null, group.type, $event)"
          @change-status="changeStatus(byId.get(id) ?? null, $event)"
        />
      </ul>
    </div>

    <!-- Sin vínculos: pulsar abre el buscador, igual que «Vincular» -->
    <button
      v-if="!task.parentId && !groups.length && !linking"
      type="button"
      class="cursor-text self-stretch rounded-lg border-0 bg-transparent px-2 py-1.5 text-left font-text text-sm text-gray-500 transition hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-gray-400 dark:hover:bg-gray-800"
      :title="t('relations.emptyHint')"
      @click="linking = true"
    >
      {{ t('relations.empty') }}
      <span class="sr-only">{{ t('relations.emptyHint') }}</span>
    </button>
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
        kind="child"
        :busy="changing === sub.id"
        :remove-label="t('subtasks.detach', { key: sub.key })"
        :status-busy="savingStatus === sub.id"
        @remove="detach(sub.id, sub.key)"
        @change-kind="changeKind(sub, 'child', $event)"
        @change-status="changeStatus(sub, $event)"
      />
    </ul>

    <SubtaskInput ref="subtaskInput" :task="task" :subtasks="subtasks" />
  </section>
</template>
