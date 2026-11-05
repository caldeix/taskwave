<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { CalendarDays, Columns3 } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'

/** Selector de vista principal: calendario mensual o kanban. */
defineProps<{ modelValue: 'calendar' | 'kanban' }>()
const emit = defineEmits<{ 'update:modelValue': [value: 'calendar' | 'kanban'] }>()
const { t } = useI18n()
</script>

<template>
  <div class="flex gap-2" role="group" :aria-label="t('views.label')">
    <BaseButton
      variant="secondary"
      :selected="modelValue === 'calendar'"
      @click="emit('update:modelValue', 'calendar')"
    >
      <CalendarDays class="h-4 w-4" aria-hidden="true" />
      {{ t('views.calendar') }}
    </BaseButton>
    <BaseButton
      variant="secondary"
      :selected="modelValue === 'kanban'"
      @click="emit('update:modelValue', 'kanban')"
    >
      <Columns3 class="h-4 w-4" aria-hidden="true" />
      {{ t('views.kanban') }}
    </BaseButton>
  </div>
</template>
