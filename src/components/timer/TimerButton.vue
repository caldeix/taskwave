<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Play, Square } from 'lucide-vue-next'
import { isClosedStatus } from '@/domain/status'
import type { Task } from '@/domain/task'
import { useTimerStore } from '@/stores/timer'

/**
 * Botón del cronómetro en la vista de tarea (step-19): «▶ Iniciar» o «■ Parar 1:05:07».
 * Si el cronómetro está en otra tarea, al iniciar se pide confirmación (D-25).
 */
const props = defineProps<{ task: Task }>()
const { t } = useI18n()
const timer = useTimerStore()

const running = computed(() => timer.isRunningOn(props.task.id))
const closed = computed(() => isClosedStatus(props.task.status))
</script>

<template>
  <button
    v-if="running"
    type="button"
    :class="[
      'inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-0 px-4 font-text text-sm font-bold text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-70',
      timer.overWarning
        ? 'bg-coral-700 hover:bg-coral-500'
        : 'bg-gray-800 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600',
    ]"
    :disabled="timer.busy"
    :aria-label="t('timer.stopLabel', { key: task.key, clock: timer.clock })"
    @click="timer.requestStop()"
  >
    <Square class="h-4 w-4 fill-current" aria-hidden="true" />
    {{ t('timer.stop') }}
    <span class="font-mono tabular-nums">{{ timer.clock }}</span>
  </button>
  <button
    v-else
    type="button"
    class="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-emerald-500 px-4 font-text text-sm font-bold text-gray-900 transition hover:bg-emerald-700 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
    :disabled="closed || timer.busy"
    :title="closed ? t('timer.closedHint') : undefined"
    :aria-label="t('timer.startLabel', { key: task.key })"
    @click="timer.requestStart(task)"
  >
    <Play class="h-4 w-4 fill-current" aria-hidden="true" />
    {{ t('timer.start') }}
  </button>
</template>
