<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AuthCard from '@/components/auth/AuthCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import FormMessage from '@/components/ui/FormMessage.vue'
import TextLink from '@/components/ui/TextLink.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const authStore = useAuthStore()
const { busy, errorKey, run } = useAsyncAction()

const email = ref('')
const sent = ref(false)

async function submit(): Promise<void> {
  sent.value = false
  // Mismo mensaje exista o no la cuenta, para no revelar qué correos están registrados.
  sent.value = await run(() => authStore.sendPasswordReset(email.value))
}
</script>

<template>
  <AuthCard :title="t('auth.reset.title')" :subtitle="t('auth.reset.subtitle')">
    <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <BaseInput
        v-model="email"
        :label="t('auth.email')"
        type="email"
        autocomplete="email"
        required
      />
      <FormMessage v-if="sent" tone="success">{{ t('auth.reset.sent') }}</FormMessage>
      <FormMessage v-if="errorKey" tone="error">{{ t(errorKey) }}</FormMessage>
      <BaseButton type="submit" block :disabled="busy || !email">
        {{ t('auth.reset.submit') }}
      </BaseButton>
    </form>
    <template #footer>
      <TextLink :to="{ name: 'login' }">{{ t('auth.reset.back') }}</TextLink>
    </template>
  </AuthCard>
</template>
