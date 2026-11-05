<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AuthCard from '@/components/auth/AuthCard.vue'
import GoogleButton from '@/components/auth/GoogleButton.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import FormMessage from '@/components/ui/FormMessage.vue'
import TextLink from '@/components/ui/TextLink.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { MIN_PASSWORD_LENGTH, validateRegister, type RegisterErrors } from '@/domain/auth'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const { busy, errorKey, run } = useAsyncAction()

const form = reactive({ name: '', email: '', password: '', confirm: '' })
const submitted = ref(false)
const errors = computed<RegisterErrors>(() => (submitted.value ? validateRegister(form) : {}))
const fieldError = (field: keyof RegisterErrors) => {
  const key = errors.value[field]
  return key ? t(key) : undefined
}

async function submit(): Promise<void> {
  submitted.value = true
  if (Object.keys(validateRegister(form)).length > 0) return
  const ok = await run(() => authStore.registerWithEmail(form.name, form.email, form.password))
  if (ok) await router.replace({ name: 'verify-email' })
}

async function google(): Promise<void> {
  if (await run(() => authStore.loginWithGoogle())) await router.replace({ name: 'home' })
}
</script>

<template>
  <AuthCard :title="t('auth.register.title')" :subtitle="t('auth.register.subtitle')">
    <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <BaseInput
        v-model="form.name"
        :label="t('auth.name')"
        autocomplete="name"
        :error="fieldError('name')"
        required
      />
      <BaseInput
        v-model="form.email"
        :label="t('auth.email')"
        type="email"
        autocomplete="email"
        :error="fieldError('email')"
        required
      />
      <BaseInput
        v-model="form.password"
        :label="t('auth.password')"
        type="password"
        autocomplete="new-password"
        :help="t('auth.passwordHelp', { min: MIN_PASSWORD_LENGTH })"
        :error="fieldError('password')"
        required
      />
      <BaseInput
        v-model="form.confirm"
        :label="t('auth.confirmPassword')"
        type="password"
        autocomplete="new-password"
        :error="fieldError('confirm')"
        required
      />
      <FormMessage v-if="errorKey" tone="error">{{ t(errorKey) }}</FormMessage>
      <BaseButton type="submit" block :disabled="busy">{{ t('auth.register.submit') }}</BaseButton>
    </form>

    <div class="flex items-center gap-3" aria-hidden="true">
      <span class="h-px flex-1 bg-gray-500 dark:bg-gray-400" />
      <span class="font-text text-sm text-gray-500 dark:text-gray-400">{{ t('auth.or') }}</span>
      <span class="h-px flex-1 bg-gray-500 dark:bg-gray-400" />
    </div>

    <GoogleButton :label="t('auth.google')" :disabled="busy" @click="google" />

    <template #footer>
      <p class="m-0 font-text text-sm text-gray-500 dark:text-gray-400">
        {{ t('auth.register.haveAccount') }}
        <TextLink :to="{ name: 'login' }">{{ t('auth.register.login') }}</TextLink>
      </p>
    </template>
  </AuthCard>
</template>
