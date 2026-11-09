<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/ui/BaseButton.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { useTaskSearch } from '@/composables/useTaskSearch'
import { countSubtasks } from '@/data/taskQueries'
import {
  MAX_LINKS,
  RELATION_KINDS,
  checkRelation,
  isLinkType,
  type RelationError,
  type RelationKind,
} from '@/domain/links'
import type { Task } from '@/domain/task'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/stores/auth'
import { useTasksStore } from '@/stores/tasks'
import { useToastsStore } from '@/stores/toasts'

/**
 * Formulario para vincular la tarea (step-16, D-41), en una fila como en Jira (v1.0.2): tipo de
 * relación a la izquierda (los de Jira y las dos de subtarea) y buscador por clave o título a la
 * derecha, con el foco ya dentro. Busca en las tareas abiertas (una consulta acotada) y, si se
 * escribe una clave exacta, también en las cerradas. Enter vincula y Esc cierra.
 */
const props = defineProps<{ task: Task; hasSubtasks: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const authStore = useAuthStore()
const tasksStore = useTasksStore()
const toasts = useToastsStore()

const kind = ref<string>('relates')
const text = ref('')
const active = ref(0)
const busy = ref(false)
const error = ref<string | null>(null)
const input = ref<HTMLInputElement | null>(null)
const uid = computed(() => authStore.user?.uid ?? null)

const selected = computed(() => kind.value as RelationKind)
const kindOptions = computed(() =>
  RELATION_KINDS.map((k) => ({ value: k, label: t(`relations.kinds.${k}`) })),
)

const { results, searchingKey } = useTaskSearch(text, { exclude: () => [props.task.id] })

watch(results, () => {
  active.value = 0
})
watch([kind, text], () => {
  error.value = null
})

function errorMessage(code: RelationError, target: Task): string {
  return t(`relations.errors.${code}`, { key: target.key, max: MAX_LINKS })
}

async function pick(target: Task): Promise<void> {
  if (busy.value) return
  busy.value = true
  error.value = null
  try {
    // Las subtareas no se guardan en la padre: se pregunta si la elegida tiene alguna.
    const targetHasSubtasks =
      selected.value === 'child' && uid.value
        ? (await countSubtasks(db, uid.value, target.id)) > 0
        : false
    const problem = checkRelation(
      props.task,
      target,
      selected.value,
      props.hasSubtasks,
      targetHasSubtasks,
    )
    if (problem) {
      error.value = errorMessage(problem, target)
      return
    }
    const k = selected.value
    if (isLinkType(k)) await tasksStore.link(props.task, { type: k, taskId: target.id })
    else if (k === 'parent') await tasksStore.setParent(props.task.id, target.id)
    else await tasksStore.setParent(target.id, props.task.id)
    toasts.show(t('relations.linked', { key: target.key }))
    emit('close')
  } catch {
    error.value = t('relations.failed')
  } finally {
    busy.value = false
  }
}

function onKeydown(event: KeyboardEvent): void {
  const count = results.value.length
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
  } else if (event.key === 'ArrowDown' && count) {
    event.preventDefault()
    active.value = (active.value + 1) % count
  } else if (event.key === 'ArrowUp' && count) {
    event.preventDefault()
    active.value = (active.value - 1 + count) % count
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const target = results.value[active.value]
    if (target) void pick(target)
  }
}

onMounted(() => void nextTick(() => input.value?.focus()))

const listId = `link-results-${Math.random().toString(36).slice(2, 8)}`
</script>

<template>
  <div
    class="flex flex-col gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700"
    @keydown.esc.prevent="emit('close')"
  >
    <div class="flex flex-col gap-2 sm:flex-row">
      <select
        v-model="kind"
        :aria-label="t('relations.kindLabel')"
        :title="t('relations.kindLabel')"
        class="h-10 shrink-0 cursor-pointer rounded-lg border-0 bg-gray-100 px-3 font-text text-sm text-gray-800 transition focus:outline-2 focus:outline-blue-500 sm:w-52 dark:bg-gray-800 dark:text-white"
      >
        <option v-for="option in kindOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <input
        ref="input"
        v-model="text"
        type="search"
        role="combobox"
        autocomplete="off"
        :aria-expanded="results.length > 0"
        :aria-controls="listId"
        :aria-activedescendant="results.length ? `${listId}-${active}` : undefined"
        :aria-label="t('relations.search')"
        :placeholder="t('relations.searchPlaceholder')"
        class="h-10 min-w-0 flex-1 rounded-lg border-0 bg-gray-100 px-4 font-text text-sm text-gray-800 transition placeholder:text-gray-500 focus:outline-2 focus:outline-blue-500 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-400"
        @keydown="onKeydown"
      />
    </div>
    <span class="-mt-1 font-text text-xs text-gray-500 dark:text-gray-400">
      {{ t('relations.searchHelp') }}
    </span>

    <ul
      v-if="results.length"
      :id="listId"
      role="listbox"
      class="m-0 flex list-none flex-col gap-0.5 p-0"
    >
      <li
        v-for="(result, index) in results"
        :id="`${listId}-${index}`"
        :key="result.id"
        role="option"
        :aria-selected="index === active"
        :class="[
          'flex min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 font-text text-sm',
          index === active
            ? 'bg-gray-100 dark:bg-gray-800'
            : 'hover:bg-gray-100 dark:hover:bg-gray-800',
        ]"
        @mouseenter="active = index"
        @mousedown.prevent
        @click="pick(result)"
      >
        <span class="shrink-0 font-bold text-gray-500 dark:text-gray-400">{{ result.key }}</span>
        <span class="min-w-0 flex-1 truncate text-gray-800 dark:text-white">{{
          result.title
        }}</span>
        <StatusBadge :status="result.status" class="shrink-0 scale-90" />
      </li>
    </ul>
    <p
      v-else-if="text.trim()"
      class="m-0 font-text text-sm text-gray-500 dark:text-gray-400"
      role="status"
    >
      {{ searchingKey ? t('relations.searching') : t('relations.noResults') }}
    </p>

    <p
      v-if="error"
      class="m-0 font-text text-sm font-bold text-coral-700 dark:text-coral-500"
      role="alert"
    >
      {{ error }}
    </p>

    <div>
      <BaseButton variant="ghost" :disabled="busy" @click="emit('close')">
        {{ t('common.cancel') }}
      </BaseButton>
    </div>
  </div>
</template>
