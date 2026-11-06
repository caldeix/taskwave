<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { format } from 'date-fns'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { validateStopAt } from '@/domain/timer'
import { formatDateTime } from '@/lib/format'
import { useTimerStore } from '@/stores/timer'

/**
 * Diálogos del cronómetro (step-19), montados una vez en el layout:
 * - cambiar de tarea con otro en marcha (D-25): se para el actual y empieza el nuevo;
 * - cronómetro olvidado (D-28): al parar después de las horas de aviso, se elige la hora de fin.
 */
const { t } = useI18n()
const timer = useTimerStore()

const switching = computed(() => (timer.pending?.kind === 'switch' ? timer.pending.task : null))
const stopping = computed(() => timer.pending?.kind === 'stop')

// ---------------------------------------------------------------- hora de fin
const endInput = ref('')
const endError = ref<string | null>(null)
const LOCAL_FORMAT = "yyyy-MM-dd'T'HH:mm"

watch(stopping, (open) => {
  if (!open) return
  endInput.value = format(new Date(), LOCAL_FORMAT)
  endError.value = null
})

async function saveAt(): Promise<void> {
  const start = timer.active?.startedAtMs
  const endMs = new Date(endInput.value).getTime()
  if (start === undefined) return
  const problem = Number.isNaN(endMs) ? 'beforeStart' : validateStopAt(start, endMs, Date.now())
  if (problem) {
    endError.value = t(`timer.forgotten.${problem}`, { start: formatDateTime(start) })
    return
  }
  await timer.confirmStop(endMs)
}
</script>

<template>
  <ConfirmDialog
    :open="switching !== null"
    :title="t('timer.switch.title')"
    :message="
      switching
        ? t('timer.switch.message', {
            current: timer.task?.key ?? '',
            clock: timer.clock,
            next: switching.key,
          })
        : ''
    "
    :confirm-label="t('timer.switch.confirm')"
    :cancel-label="t('common.cancel')"
    tone="primary"
    :busy="timer.busy"
    @confirm="timer.confirmSwitch()"
    @cancel="timer.cancelPending()"
  />

  <BaseDialog :open="stopping" :title="t('timer.forgotten.title')" @close="timer.cancelPending()">
    <p class="m-0 font-text text-sm leading-normal text-gray-500 dark:text-gray-400">
      {{ t('timer.forgotten.message', { key: timer.task?.key ?? '', clock: timer.clock }) }}
    </p>
    <form class="flex flex-col gap-4" @submit.prevent="saveAt">
      <label class="flex flex-col gap-1">
        <span class="font-text text-sm font-medium text-gray-800 dark:text-white">
          {{ t('timer.forgotten.endLabel') }}
        </span>
        <input
          v-model="endInput"
          type="datetime-local"
          required
          :aria-invalid="endError ? 'true' : undefined"
          class="h-10 w-full rounded-lg border-0 bg-gray-100 px-4 font-text text-sm text-gray-800 focus:outline-2 focus:outline-blue-500 dark:bg-gray-800 dark:text-white"
          @input="endError = null"
        />
        <span
          v-if="endError"
          class="font-text text-sm font-medium text-coral-700 dark:text-coral-500"
          role="alert"
        >
          {{ endError }}
        </span>
      </label>
      <div class="flex flex-wrap justify-end gap-3">
        <BaseButton variant="secondary" :disabled="timer.busy" @click="timer.confirmStop()">
          {{ t('timer.forgotten.saveNow') }}
        </BaseButton>
        <BaseButton type="submit" :disabled="timer.busy">
          {{ t('timer.forgotten.saveAt') }}
        </BaseButton>
      </div>
    </form>
  </BaseDialog>
</template>
