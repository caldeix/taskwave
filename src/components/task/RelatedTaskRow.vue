<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeftRight, X } from 'lucide-vue-next'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { formatHours } from '@/domain/duration'
import { RELATION_KINDS, type RelationKind } from '@/domain/links'
import type { Task } from '@/domain/task'

/**
 * Una tarea relacionada (vinculada, padre o subtarea): clave y título que llevan a la tarea,
 * estado y, si se pide, horas. Si ya no existe, lo dice y deja quitar el vínculo.
 * Con `kind`, el tipo de relación se ve en un selector y se puede cambiar (v1.0.2). Si la fila
 * es estrecha (panel lateral abierto), el selector se queda en un icono para no tapar el título.
 */
const props = defineProps<{
  task: Task | null
  loading?: boolean
  removeLabel: string
  showHours?: boolean
  kind?: RelationKind
  busy?: boolean
}>()
const emit = defineEmits<{ remove: []; changeKind: [kind: RelationKind] }>()

function onKindChange(event: Event): void {
  const select = event.target as HTMLSelectElement
  const value = select.value as RelationKind
  // El selector vuelve al tipo guardado: si el cambio se guarda, la fila pasa a su nuevo grupo;
  // si no se puede, se queda como estaba.
  select.value = props.kind ?? ''
  if (value !== props.kind) emit('changeKind', value)
}
const { t } = useI18n()

const hours = computed(() => {
  if (!props.task) return ''
  const spent = formatHours(props.task.spentMin)
  return props.task.estimateMin !== null
    ? `${spent} / ${formatHours(props.task.estimateMin)}`
    : spent
})
</script>

<template>
  <li
    class="group @container flex min-w-0 items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800"
  >
    <template v-if="task">
      <span v-if="kind" class="relative inline-flex shrink-0">
        <select
          :value="kind"
          :disabled="busy"
          :aria-label="t('relations.kindOf', { key: task.key })"
          :title="t('relations.kindOf', { key: task.key })"
          class="h-7 w-8 cursor-pointer appearance-none truncate rounded-lg border-0 bg-transparent px-1.5 font-text text-xs text-transparent transition hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-60 @md:w-auto @md:max-w-44 @md:appearance-auto @md:text-gray-500 @md:hover:text-gray-800 dark:hover:bg-gray-700 @md:dark:text-gray-400 @md:dark:hover:text-white"
          @change="onKindChange"
        >
          <option
            v-for="k in RELATION_KINDS"
            :key="k"
            :value="k"
            class="bg-white text-gray-800 dark:bg-gray-800 dark:text-white"
          >
            {{ t(`relations.kinds.${k}`) }}
          </option>
        </select>
        <ArrowLeftRight
          class="pointer-events-none absolute inset-0 m-auto h-4 w-4 text-gray-500 @md:hidden dark:text-gray-400"
          aria-hidden="true"
        />
      </span>
      <RouterLink
        :to="{ name: 'task', params: { taskKey: task.key } }"
        class="flex min-w-0 flex-1 items-center gap-2 font-text text-sm no-underline"
      >
        <span class="shrink-0 font-bold text-blue-600 dark:text-blue-400">{{ task.key }}</span>
        <span
          :class="[
            'min-w-0 truncate text-gray-800 dark:text-white',
            task.status === 'done' || task.status === 'discarded' ? 'line-through opacity-70' : '',
          ]"
          >{{ task.title }}</span
        >
      </RouterLink>
      <span
        v-if="showHours"
        class="hidden shrink-0 font-text text-xs text-gray-500 sm:inline dark:text-gray-400"
        >{{ hours }}</span
      >
      <StatusBadge :status="task.status" class="shrink-0" />
    </template>
    <span v-else class="flex-1 font-text text-sm text-gray-500 italic dark:text-gray-400">
      {{ loading ? t('relations.loading') : t('relations.missing') }}
    </span>
    <button
      type="button"
      class="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-gray-500 transition hover:bg-gray-200 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
      :aria-label="removeLabel"
      :title="removeLabel"
      @click="emit('remove')"
    >
      <X class="h-4 w-4" aria-hidden="true" />
    </button>
  </li>
</template>
