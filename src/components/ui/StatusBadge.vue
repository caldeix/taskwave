<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { STATUS_STYLES, type TaskStatus } from '@/domain/status'

defineProps<{ status: TaskStatus }>()
const { t } = useI18n()
</script>

<template>
  <span
    :class="[
      'inline-flex h-6 items-center rounded-full px-3 font-text text-sm font-bold',
      STATUS_STYLES[status].badge,
    ]"
  >
    {{ t(`status.${status}`) }}
  </span>
</template>
