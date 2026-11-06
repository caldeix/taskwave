<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import { todayKey } from '@/domain/dates'
import { formatDuration } from '@/domain/duration'
import {
  MAX_NOTE,
  parseEntry,
  timeOf,
  type Entry,
  type EntryErrors,
  type Worklog,
} from '@/domain/worklog'
import { useProfileStore } from '@/stores/profile'

/**
 * Formulario de una entrada del registro de horas (step-20, D-29, D-30): día, tiempo en formato
 * `1h 30m` (1d = la jornada), hora de inicio y nota. Sirve para añadir y para editar.
 */
const props = defineProps<{ initial?: Worklog | null; busy?: boolean }>()
const emit = defineEmits<{ submit: [entry: Entry]; cancel: [] }>()

const { t } = useI18n()
const profileStore = useProfileStore()
const hoursPerDay = computed(() => profileStore.prefs.hoursPerDay)

const form = reactive({
  date: props.initial?.date ?? todayKey(),
  duration: props.initial ? formatDuration(props.initial.minutes, hoursPerDay.value) : '',
  startTime: props.initial ? timeOf(props.initial.startedAtMs) || '09:00' : '09:00',
  note: props.initial?.note ?? '',
})
const errors = ref<EntryErrors>({})

function submit(): void {
  const result = parseEntry(form, todayKey(), hoursPerDay.value)
  errors.value = result.errors
  if (result.entry) emit('submit', result.entry)
}

const err = (key: keyof EntryErrors) => (errors.value[key] ? t(errors.value[key]!) : undefined)
</script>

<template>
  <form
    class="flex flex-col gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700"
    novalidate
    @submit.prevent="submit"
    @keydown.esc.prevent="emit('cancel')"
  >
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <BaseInput
        v-model="form.date"
        type="date"
        :label="t('worklog.fields.date')"
        :error="err('date')"
      />
      <BaseInput
        v-model="form.duration"
        :label="t('worklog.fields.duration')"
        placeholder="1h 30m"
        autocomplete="off"
        :error="err('duration')"
      />
      <BaseInput
        v-model="form.startTime"
        type="time"
        :label="t('worklog.fields.startTime')"
        :error="err('startTime')"
      />
    </div>
    <p class="m-0 -mt-1 font-text text-sm text-gray-500 dark:text-gray-400">
      {{ t('worklog.fields.durationHelp', { hours: hoursPerDay }) }}
    </p>
    <BaseInput
      v-model="form.note"
      :label="t('worklog.fields.note')"
      :placeholder="t('worklog.fields.notePlaceholder')"
      autocomplete="off"
      :error="err('note') ? t('worklog.errors.note', { max: MAX_NOTE }) : undefined"
    />
    <div class="flex flex-wrap gap-2">
      <BaseButton type="submit" :disabled="busy">
        {{ initial ? t('worklog.save') : t('worklog.create') }}
      </BaseButton>
      <BaseButton variant="ghost" :disabled="busy" @click="emit('cancel')">
        {{ t('common.cancel') }}
      </BaseButton>
    </div>
  </form>
</template>
