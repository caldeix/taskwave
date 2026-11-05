<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { UserStatus } from '@/domain/profile'

/** Estado de una cuenta, con los colores del DS (pendiente violeta, activa esmeralda, bloqueada coral). */
defineProps<{ status: UserStatus }>()
const { t } = useI18n()

const STYLES: Record<UserStatus, string> = {
  pending: 'bg-violet-500 text-white',
  active: 'bg-emerald-500 text-gray-900',
  blocked: 'bg-coral-500 text-gray-900',
}
</script>

<template>
  <span
    :class="[
      'inline-flex h-6 items-center rounded-full px-3 font-text text-sm font-bold whitespace-nowrap',
      STYLES[status],
    ]"
  >
    {{ t(`admin.status.${status}`) }}
  </span>
</template>
