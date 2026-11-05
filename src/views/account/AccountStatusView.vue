<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Clock, RefreshCw, ShieldX, WifiOff } from 'lucide-vue-next'
import AuthCard from '@/components/auth/AuthCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'

/** Pantallas de cuenta pendiente, bloqueada o con error al cargar el perfil (step-5). */
const props = defineProps<{ kind: 'pending' | 'blocked' }>()

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const profileStore = useProfileStore()
const { busy, run } = useAsyncAction()

const mode = computed(() => (profileStore.status === 'error' ? 'error' : props.kind))
const email = computed(() => authStore.user?.email ?? '')

async function logout(): Promise<void> {
  await authStore.logout()
  await router.replace({ name: 'login' })
}

async function retry(): Promise<void> {
  await run(() => profileStore.retry())
}
</script>

<template>
  <AuthCard
    :title="t(`account.${mode}.title`)"
    :subtitle="t(`account.${mode}.subtitle`, { email })"
  >
    <div class="flex items-start gap-3">
      <Clock
        v-if="mode === 'pending'"
        class="h-6 w-6 shrink-0 text-violet-700 dark:text-violet-500"
        aria-hidden="true"
      />
      <ShieldX
        v-else-if="mode === 'blocked'"
        class="h-6 w-6 shrink-0 text-coral-700 dark:text-coral-500"
        aria-hidden="true"
      />
      <WifiOff
        v-else
        class="h-6 w-6 shrink-0 text-mustard-700 dark:text-mustard-500"
        aria-hidden="true"
      />
      <p
        v-if="mode === 'pending'"
        class="m-0 font-text text-sm leading-normal text-gray-800 dark:text-white"
        role="status"
      >
        {{ t('account.pending.live') }}
      </p>
    </div>

    <div class="flex flex-col gap-3">
      <BaseButton v-if="mode === 'error'" block :disabled="busy" @click="retry">
        <RefreshCw class="h-4 w-4" aria-hidden="true" />
        {{ t('account.error.retry') }}
      </BaseButton>
      <BaseButton variant="secondary" block @click="logout">{{ t('auth.logout') }}</BaseButton>
    </div>
  </AuthCard>
</template>
