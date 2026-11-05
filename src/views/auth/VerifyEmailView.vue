<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AuthCard from '@/components/auth/AuthCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import FormMessage from '@/components/ui/FormMessage.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const { busy, errorKey, run } = useAsyncAction()

const notice = ref<'resent' | 'notYet' | null>(null)

async function check(): Promise<void> {
  notice.value = null
  if (!(await run(() => authStore.refreshUser()))) return
  if (authStore.mustVerifyEmail) notice.value = 'notYet'
  else await router.replace({ name: 'home' })
}

async function resend(): Promise<void> {
  notice.value = null
  if (await run(() => authStore.resendVerification())) notice.value = 'resent'
}

async function logout(): Promise<void> {
  await authStore.logout()
  await router.replace({ name: 'login' })
}
</script>

<template>
  <AuthCard
    :title="t('auth.verify.title')"
    :subtitle="t('auth.verify.subtitle', { email: authStore.user?.email ?? '' })"
  >
    <div class="flex flex-col gap-4">
      <FormMessage v-if="notice === 'resent'" tone="success">{{
        t('auth.verify.resent')
      }}</FormMessage>
      <FormMessage v-if="notice === 'notYet'" tone="warning">{{
        t('auth.verify.notYet')
      }}</FormMessage>
      <FormMessage v-if="errorKey" tone="error">{{ t(errorKey) }}</FormMessage>
      <BaseButton block :disabled="busy" @click="check">{{ t('auth.verify.check') }}</BaseButton>
      <BaseButton variant="secondary" block :disabled="busy" @click="resend">
        {{ t('auth.verify.resend') }}
      </BaseButton>
    </div>
    <template #footer>
      <p class="m-0 font-text text-sm text-gray-500 dark:text-gray-400">
        {{ t('auth.verify.wrongAccount') }}
        <button
          type="button"
          class="cursor-pointer border-0 bg-transparent p-0 font-text text-sm font-medium text-blue-600 transition hover:font-semibold hover:text-blue-500 dark:text-blue-400"
          @click="logout"
        >
          {{ t('auth.logout') }}
        </button>
      </p>
    </template>
  </AuthCard>
</template>
