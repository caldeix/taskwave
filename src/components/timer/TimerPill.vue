<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { Square, Timer } from 'lucide-vue-next'
import { useTimerStore } from '@/stores/timer'

/**
 * Mini cronómetro global (step-19): se ve en toda la app mientras hay uno en marcha, lleva a la
 * tarea y se puede parar desde aquí. En coral a partir de las horas de aviso (D-28).
 * `compact` para el menú plegado y la cabecera del móvil.
 */
defineProps<{ compact?: boolean }>()
const { t } = useI18n()
const timer = useTimerStore()
</script>

<template>
  <div
    v-if="timer.active"
    :class="[
      'flex min-w-0 items-center gap-1 rounded-lg font-text text-sm',
      timer.overWarning ? 'bg-coral-500 text-gray-900' : 'bg-emerald-500 text-gray-900',
      compact ? 'flex-col p-1' : 'p-1 pl-2',
    ]"
    role="group"
    :aria-label="t('timer.running')"
  >
    <RouterLink
      v-if="timer.task"
      :to="{ name: 'task', params: { taskKey: timer.task.key } }"
      :title="t('timer.runningOn', { key: timer.task.key, clock: timer.clock })"
      class="flex min-w-0 flex-1 items-center gap-1.5 text-inherit no-underline hover:underline"
    >
      <Timer class="h-4 w-4 shrink-0" aria-hidden="true" />
      <span class="font-mono font-bold tabular-nums">{{ timer.clock }}</span>
      <span v-if="!compact" class="truncate">· {{ timer.task.key }}</span>
    </RouterLink>
    <span v-else class="flex flex-1 items-center gap-1.5">
      <Timer class="h-4 w-4 shrink-0" aria-hidden="true" />
      <span class="font-mono font-bold tabular-nums">{{ timer.clock }}</span>
    </span>
    <button
      type="button"
      class="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-inherit transition hover:bg-black/15 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-wait"
      :disabled="timer.busy"
      :aria-label="t('timer.stopLabel', { key: timer.task?.key ?? '', clock: timer.clock })"
      :title="t('timer.stop')"
      @click="timer.requestStop()"
    >
      <Square class="h-3.5 w-3.5 fill-current" aria-hidden="true" />
    </button>
  </div>
</template>
