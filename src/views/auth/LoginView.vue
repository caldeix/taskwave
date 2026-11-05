<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AuthCard from '@/components/auth/AuthCard.vue'
import GoogleButton from '@/components/auth/GoogleButton.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import FormMessage from '@/components/ui/FormMessage.vue'
import TextLink from '@/components/ui/TextLink.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { safeRedirect } from '@/domain/auth'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { busy, errorKey, run } = useAsyncAction()

const email = ref('')
const password = ref('')

async function goNext(): Promise<void> {
  if (authStore.mustVerifyEmail) await router.replace({ name: 'verify-email' })
  else await router.replace(safeRedirect(route.query.redirect) ?? { name: 'home' })
}

async function submit(): Promise<void> {
  if (await run(() => authStore.loginWithEmail(email.value, password.value))) await goNext()
}

async function google(): Promise<void> {
  if (await run(() => authStore.loginWithGoogle())) await goNext()
}
</script>

<template>
  <AuthCard :title="t('auth.login.title')" :subtitle="t('auth.login.subtitle')">
    <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <BaseInput
        v-model="email"
        :label="t('auth.email')"
        type="email"
        autocomplete="email"
        required
      />
      <BaseInput
        v-model="password"
        :label="t('auth.password')"
        type="password"
        autocomplete="current-password"
        required
      />
      <FormMessage v-if="errorKey" tone="error">{{ t(errorKey) }}</FormMessage>
      <BaseButton type="submit" block :disabled="busy || !email || !password">
        {{ t('auth.login.submit') }}
      </BaseButton>
      <TextLink :to="{ name: 'reset-password' }" class="self-start">
        {{ t('auth.login.forgot') }}
      </TextLink>
    </form>

    <div class="flex items-center gap-3" aria-hidden="true">
      <span class="h-px flex-1 bg-gray-500 dark:bg-gray-400" />
      <span class="font-text text-sm text-gray-500 dark:text-gray-400">{{ t('auth.or') }}</span>
      <span class="h-px flex-1 bg-gray-500 dark:bg-gray-400" />
    </div>

    <GoogleButton :label="t('auth.google')" :disabled="busy" @click="google" />

    <template #footer>
      <p class="m-0 font-text text-sm text-gray-500 dark:text-gray-400">
        {{ t('auth.login.noAccount') }}
        <TextLink :to="{ name: 'register', query: route.query }">
          {{ t('auth.login.register') }}
        </TextLink>
      </p>
    </template>
  </AuthCard>
</template>
