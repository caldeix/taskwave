<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus } from 'lucide-vue-next'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { useTaskSearch } from '@/composables/useTaskSearch'
import { countSubtasks } from '@/data/taskQueries'
import { MAX_LINKS, checkRelation } from '@/domain/links'
import type { Task } from '@/domain/task'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/stores/auth'
import { useTasksStore } from '@/stores/tasks'
import { useToastsStore } from '@/stores/toasts'

/**
 * Alta de subtareas en la vista de tarea (step-16, v1.0.2). Al escribir propone crear una
 * subtarea nueva con ese título (la primera opción, la de Enter) o convertir en subtarea una
 * tarea existente que coincida por clave o título. Flechas para elegir, Esc para limpiar.
 */
const props = defineProps<{ task: Task; subtasks: Task[] }>()

const { t } = useI18n()
const authStore = useAuthStore()
const tasksStore = useTasksStore()
const toasts = useToastsStore()

const text = ref('')
const focused = ref(false)
const active = ref(0)
const busy = ref(false)
const error = ref<string | null>(null)
const input = ref<HTMLInputElement | null>(null)

const title = computed(() => text.value.trim())
// Las tareas abiertas solo se escuchan mientras se escribe.
const { results } = useTaskSearch(text, {
  enabled: () => title.value.length > 0,
  exclude: () => [props.task.id, ...props.subtasks.map((s) => s.id)],
  max: 6,
})

/** Opción 0: crear la subtarea nueva; después, las tareas existentes que coinciden. */
const optionCount = computed(() => (title.value ? 1 + results.value.length : 0))
const open = computed(() => focused.value && optionCount.value > 0)

watch(text, () => {
  active.value = 0
  error.value = null
})

async function create(): Promise<void> {
  busy.value = true
  try {
    const { key } = await tasksStore.create({
      title: title.value,
      projectId: props.task.projectId,
      startDate: null,
      endDate: null,
      priority: props.task.priority,
      parentId: props.task.id,
    })
    text.value = ''
    toasts.show(t('subtasks.created', { key }))
  } catch {
    toasts.show(t('subtasks.createFailed'), 'error')
  } finally {
    busy.value = false
    refocus()
  }
}

async function adopt(target: Task): Promise<void> {
  const uid = authStore.user?.uid
  if (!uid) return
  busy.value = true
  try {
    // Un solo nivel: una tarea que ya tiene subtareas no puede ser subtarea.
    const targetSubtasks = await countSubtasks(db, uid, target.id)
    const problem = checkRelation(
      props.task,
      target,
      'child',
      props.subtasks.length > 0,
      targetSubtasks > 0,
    )
    if (problem) {
      error.value = t(`relations.errors.${problem}`, { key: target.key, max: MAX_LINKS })
      return
    }
    await tasksStore.setParent(target.id, props.task.id)
    text.value = ''
    toasts.show(t('subtasks.adopted', { key: target.key }))
  } catch {
    error.value = t('relations.failed')
  } finally {
    busy.value = false
    refocus()
  }
}

/** Tras guardar, el foco vuelve al campo para seguir añadiendo. */
function refocus(): void {
  requestAnimationFrame(() => input.value?.focus())
}

function choose(index: number): void {
  if (busy.value || !title.value) return
  const target = index > 0 ? results.value[index - 1] : undefined
  void (target ? adopt(target) : create())
}

function onKeydown(event: KeyboardEvent): void {
  const count = optionCount.value
  if (event.key === 'Escape') {
    if (!text.value) return
    event.preventDefault()
    text.value = ''
  } else if (event.key === 'ArrowDown' && count) {
    event.preventDefault()
    active.value = (active.value + 1) % count
  } else if (event.key === 'ArrowUp' && count) {
    event.preventDefault()
    active.value = (active.value - 1 + count) % count
  } else if (event.key === 'Enter') {
    event.preventDefault()
    choose(active.value)
  }
}

const listId = `subtask-options-${Math.random().toString(36).slice(2, 8)}`
const optionClass = (index: number) => [
  'flex min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 font-text text-sm',
  index === active.value
    ? 'bg-gray-100 dark:bg-gray-800'
    : 'hover:bg-gray-100 dark:hover:bg-gray-800',
]
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex items-center gap-2">
      <Plus class="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" aria-hidden="true" />
      <input
        ref="input"
        v-model="text"
        type="text"
        role="combobox"
        autocomplete="off"
        maxlength="200"
        :aria-label="t('subtasks.add')"
        :aria-expanded="open"
        :aria-controls="listId"
        :aria-activedescendant="open ? `${listId}-${active}` : undefined"
        :placeholder="t('subtasks.addPlaceholder')"
        :disabled="busy"
        class="h-9 min-w-0 flex-1 rounded-lg border-0 bg-transparent px-2 font-text text-sm text-gray-800 transition placeholder:text-gray-500 hover:bg-gray-100 focus:bg-gray-100 focus:outline-2 focus:outline-blue-500 dark:text-white dark:placeholder:text-gray-400 dark:hover:bg-gray-800 dark:focus:bg-gray-800"
        @focus="focused = true"
        @blur="focused = false"
        @keydown="onKeydown"
      />
    </div>

    <ul
      v-show="open"
      :id="listId"
      role="listbox"
      :aria-label="t('subtasks.add')"
      class="m-0 ml-6 flex list-none flex-col gap-0.5 p-0"
    >
      <li
        :id="`${listId}-0`"
        role="option"
        :aria-selected="active === 0"
        :class="optionClass(0)"
        @mouseenter="active = 0"
        @mousedown.prevent
        @click="choose(0)"
      >
        <Plus class="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <span class="min-w-0 flex-1 truncate text-gray-800 dark:text-white">
          {{ t('subtasks.createNamed', { title }) }}
        </span>
      </li>
      <li
        v-if="results.length"
        role="presentation"
        class="mt-1 px-2 font-text text-xs font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400"
      >
        {{ t('subtasks.existing') }}
      </li>
      <li
        v-for="(result, index) in results"
        :id="`${listId}-${index + 1}`"
        :key="result.id"
        role="option"
        :aria-selected="active === index + 1"
        :class="optionClass(index + 1)"
        @mouseenter="active = index + 1"
        @mousedown.prevent
        @click="choose(index + 1)"
      >
        <span class="shrink-0 font-bold text-gray-500 dark:text-gray-400">{{ result.key }}</span>
        <span class="min-w-0 flex-1 truncate text-gray-800 dark:text-white">{{
          result.title
        }}</span>
        <span
          v-if="result.parentId"
          class="hidden shrink-0 font-text text-xs text-gray-500 sm:inline dark:text-gray-400"
          >{{ t('subtasks.movesFromOther') }}</span
        >
        <StatusBadge :status="result.status" class="shrink-0 scale-90" />
      </li>
    </ul>

    <p
      v-if="error"
      class="m-0 ml-6 font-text text-sm font-bold text-coral-700 dark:text-coral-500"
      role="alert"
    >
      {{ error }}
    </p>
  </div>
</template>
