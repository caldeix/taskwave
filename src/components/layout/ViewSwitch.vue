<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { CalendarDays, Columns3, List, ListOrdered } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import type { MainView } from '@/domain/views'

/** Selector de vista principal: calendario, kanban, lista (v1.1.0) y backlog (v1.1.0). */
defineProps<{ modelValue: MainView }>()
const emit = defineEmits<{ 'update:modelValue': [value: MainView] }>()
const { t } = useI18n()

const VIEWS = [
  { id: 'calendar', icon: CalendarDays },
  { id: 'kanban', icon: Columns3 },
  { id: 'list', icon: List },
  { id: 'backlog', icon: ListOrdered },
] as const
</script>

<template>
  <div class="flex flex-wrap gap-2" role="group" :aria-label="t('views.label')">
    <BaseButton
      v-for="view in VIEWS"
      :key="view.id"
      variant="secondary"
      :selected="modelValue === view.id"
      @click="emit('update:modelValue', view.id)"
    >
      <component :is="view.icon" class="h-4 w-4" aria-hidden="true" />
      {{ t(`views.${view.id}`) }}
    </BaseButton>
  </div>
</template>
