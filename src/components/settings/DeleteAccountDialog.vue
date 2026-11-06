<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import FormMessage from '@/components/ui/FormMessage.vue'
import { DELETE_CONFIRM_WORD, isDeleteConfirmed } from '@/domain/settings'
import { useAuthStore } from '@/stores/auth'

/**
 * Baja de la cuenta (step-25, P-9, CA-18). Hay que escribir la palabra de confirmación y volver
 * a identificarse (contraseña o ventana de Google) antes de borrar nada; después se borran todos
 * los datos, el perfil y la cuenta de Auth, y se vuelve al login.
 */
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const authStore = useAuthStore()

const word = ref('')
const password = ref('')
const busy = ref(false)
const step = ref<'idle' | 'checking' | 'deleting'>('idle')
const error = ref<string | null>(null)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    word.value = ''
    password.value = ''
    error.value = null
    step.value = 'idle'
  },
)

const ready = computed(
  () => isDeleteConfirmed(word.value) && (!authStore.usesPassword || password.value.length > 0),
)

function authError(code: string | undefined): string {
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential')
    return t('settings.delete.errors.password')
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request')
    return t('settings.delete.errors.popup')
  if (code === 'auth/too-many-requests') return t('settings.delete.errors.tooMany')
  return t('settings.delete.errors.generic')
}

async function confirm(): Promise<void> {
  if (!ready.value || busy.value) return
  busy.value = true
  error.value = null
  try {
    step.value = 'checking'
    await authStore.reauthenticate(password.value)
  } catch (e) {
    error.value = authError((e as { code?: string }).code)
    busy.value = false
    step.value = 'idle'
    return
  }
  try {
    step.value = 'deleting'
    // Un cronómetro en marcha se descarta con el perfil: todo se borra.
    await authStore.deleteAccount()
  } catch (e) {
    error.value = authError((e as { code?: string }).code)
    busy.value = false
    step.value = 'idle'
  }
}
</script>

<template>
  <BaseDialog :open="open" :title="t('settings.delete.title')" @close="busy || emit('close')">
    <div class="flex flex-col gap-3 font-text text-sm text-gray-800 dark:text-white">
      <p class="m-0">{{ t('settings.delete.intro') }}</p>
      <ul class="m-0 flex flex-col gap-1 pl-5 text-gray-500 dark:text-gray-400">
        <li>{{ t('settings.delete.items.tasks') }}</li>
        <li>{{ t('settings.delete.items.hours') }}</li>
        <li>{{ t('settings.delete.items.projects') }}</li>
        <li>{{ t('settings.delete.items.account') }}</li>
      </ul>
      <p class="m-0 font-bold">{{ t('settings.delete.irreversible') }}</p>
    </div>

    <form class="flex flex-col gap-3" @submit.prevent="confirm">
      <BaseInput
        v-model="word"
        :label="t('settings.delete.wordLabel', { word: DELETE_CONFIRM_WORD })"
        autocomplete="off"
        :disabled="busy"
      />
      <BaseInput
        v-if="authStore.usesPassword"
        v-model="password"
        type="password"
        :label="t('settings.delete.password')"
        autocomplete="current-password"
        :disabled="busy"
      />
      <p v-else class="m-0 font-text text-sm text-gray-500 dark:text-gray-400">
        {{ t('settings.delete.google') }}
      </p>

      <FormMessage v-if="error" tone="error">{{ error }}</FormMessage>
      <FormMessage v-else-if="step === 'deleting'" tone="warning">
        {{ t('settings.delete.deleting') }}
      </FormMessage>

      <div class="flex flex-wrap justify-end gap-3">
        <BaseButton variant="secondary" :disabled="busy" @click="emit('close')">
          {{ t('common.cancel') }}
        </BaseButton>
        <BaseButton type="submit" variant="danger" :disabled="!ready || busy">
          {{ busy ? t('settings.delete.working') : t('settings.delete.confirm') }}
        </BaseButton>
      </div>
    </form>
  </BaseDialog>
</template>
