<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Users } from 'lucide-vue-next'
import { useAdminStore } from '@/stores/admin'
import { useProfileStore } from '@/stores/profile'

/**
 * Acceso al panel de usuarios con el contador de pendientes en vivo (D-9).
 * Solo se muestra al admin. En el step-8 pasa al menú lateral.
 */
const { t } = useI18n()
const profileStore = useProfileStore()
const adminStore = useAdminStore()
</script>

<template>
  <RouterLink
    v-if="profileStore.isAdmin"
    :to="{ name: 'admin-users' }"
    class="inline-flex h-10 items-center gap-2 rounded-lg bg-gray-200 px-4 font-text text-sm font-bold text-gray-800 no-underline transition hover:bg-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
  >
    <Users class="h-4 w-4" aria-hidden="true" />
    {{ t('admin.link') }}
    <span
      v-if="adminStore.pendingCount > 0"
      class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-500 px-1.5 text-xs text-white"
      :aria-label="t('admin.pendingBadge', { n: adminStore.pendingCount }, adminStore.pendingCount)"
    >
      {{ adminStore.pendingCount }}
    </span>
  </RouterLink>
</template>
