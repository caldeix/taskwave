<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Settings, Trash2 } from 'lucide-vue-next'
import DeleteAccountDialog from '@/components/settings/DeleteAccountDialog.vue'
import TemplatesSettings from '@/components/settings/TemplatesSettings.vue'
import TrashSettings from '@/components/settings/TrashSettings.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import FormMessage from '@/components/ui/FormMessage.vue'
import { useThemeChoice } from '@/composables/useThemeSync'
import type { ThemeMode } from '@/composables/useTheme'
import { parseSettings, type SettingsErrors } from '@/domain/settings'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { useToastsStore } from '@/stores/toasts'

/**
 * Ajustes (step-25, P-8, P-9, CA-18): nombre, jornada del «1d», aviso del cronómetro olvidado,
 * tema (guardado en el perfil) y baja de la cuenta.
 */
const { t } = useI18n()
const authStore = useAuthStore()
const profileStore = useProfileStore()
const toasts = useToastsStore()
const theme = useThemeChoice()

const version = __APP_VERSION__

// ---------------------------------------------------------------- perfil y trabajo
const form = reactive({ displayName: '', hoursPerDay: '', timerWarnHours: '' })
const errors = ref<SettingsErrors>({})
const saving = ref(false)

function fill(): void {
  form.displayName = profileStore.profile?.displayName ?? ''
  form.hoursPerDay = String(profileStore.prefs.hoursPerDay)
  form.timerWarnHours = String(profileStore.prefs.timerWarnHours)
}
watch(() => profileStore.profile !== null, fill, { immediate: true })

async function save(): Promise<void> {
  const result = parseSettings(form)
  errors.value = result.errors
  if (!result.settings) return
  saving.value = true
  try {
    const { displayName, hoursPerDay, timerWarnHours } = result.settings
    await Promise.all([
      profileStore.updateDisplayName(displayName),
      profileStore.updatePrefs({ hoursPerDay, timerWarnHours }),
    ])
    form.displayName = displayName
    toasts.show(t('settings.saved'))
  } catch {
    toasts.show(t('settings.saveFailed'), 'error')
  } finally {
    saving.value = false
  }
}
const err = (key: keyof SettingsErrors) => (errors.value[key] ? t(errors.value[key]!) : undefined)

// ---------------------------------------------------------------- tema
const THEMES: ThemeMode[] = ['light', 'dark', 'system']

// ---------------------------------------------------------------- cuenta
const provider = computed(() =>
  authStore.usesPassword ? t('settings.account.password') : t('settings.account.google'),
)
const deleting = ref(false)

const card = 'flex flex-col gap-4 rounded-lg border border-gray-200 p-5 dark:border-gray-700'
const heading = 'm-0 font-text text-base font-bold text-gray-800 dark:text-white'
</script>

<template>
  <main class="flex min-w-0 flex-1 flex-col gap-6 px-4 py-6 md:px-8">
    <header class="flex min-w-0 items-center gap-3">
      <span
        class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800"
      >
        <Settings class="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
      </span>
      <h1
        class="m-0 w-fit bg-radial-blue bg-clip-text font-title text-4xl leading-tight font-semibold text-transparent"
      >
        {{ t('settings.title') }}
      </h1>
    </header>

    <div class="flex max-w-2xl flex-col gap-6">
      <!-- Perfil y trabajo -->
      <section :class="card">
        <h2 :class="heading">{{ t('settings.profile.title') }}</h2>
        <form class="flex flex-col gap-4" novalidate @submit.prevent="save">
          <BaseInput
            v-model="form.displayName"
            :label="t('settings.profile.name')"
            autocomplete="name"
            :error="err('displayName')"
          />
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <BaseInput
              v-model="form.hoursPerDay"
              :label="t('settings.profile.hoursPerDay')"
              :help="t('settings.profile.hoursPerDayHelp')"
              :error="err('hoursPerDay')"
            />
            <BaseInput
              v-model="form.timerWarnHours"
              :label="t('settings.profile.timerWarnHours')"
              :help="t('settings.profile.timerWarnHoursHelp')"
              :error="err('timerWarnHours')"
            />
          </div>
          <div>
            <BaseButton type="submit" :disabled="saving">
              {{ saving ? t('common.saving') : t('common.save') }}
            </BaseButton>
          </div>
        </form>
      </section>

      <!-- Apariencia -->
      <section :class="card">
        <h2 :class="heading">{{ t('settings.theme.title') }}</h2>
        <fieldset class="m-0 flex flex-wrap gap-4 border-0 p-0">
          <legend class="sr-only">{{ t('settings.theme.title') }}</legend>
          <label
            v-for="mode in THEMES"
            :key="mode"
            class="flex cursor-pointer items-center gap-2 font-text text-sm text-gray-800 dark:text-white"
          >
            <input
              type="radio"
              name="theme"
              class="h-4 w-4 cursor-pointer accent-blue-500"
              :checked="theme.mode.value === mode"
              @change="theme.choose(mode)"
            />
            {{ t(`settings.theme.${mode}`) }}
          </label>
        </fieldset>
        <p class="m-0 font-text text-sm text-gray-500 dark:text-gray-400">
          {{ t('settings.theme.help') }}
        </p>
      </section>

      <!-- Cuenta -->
      <section :class="card">
        <h2 :class="heading">{{ t('settings.account.title') }}</h2>
        <dl class="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-text text-sm">
          <dt class="text-gray-500 dark:text-gray-400">{{ t('settings.account.email') }}</dt>
          <dd class="m-0 min-w-0 truncate text-gray-800 dark:text-white">
            {{ authStore.user?.email }}
          </dd>
          <dt class="text-gray-500 dark:text-gray-400">{{ t('settings.account.method') }}</dt>
          <dd class="m-0 text-gray-800 dark:text-white">{{ provider }}</dd>
          <dt class="text-gray-500 dark:text-gray-400">{{ t('settings.account.version') }}</dt>
          <dd class="m-0 text-gray-800 dark:text-white">TaskWave {{ version }}</dd>
        </dl>
      </section>

      <!-- Plantillas (v1.1.0) -->
      <TemplatesSettings />

      <!-- Papelera (v1.1.0) -->
      <TrashSettings />

      <!-- Baja -->
      <section :class="[card, 'border-coral-500 dark:border-coral-700']">
        <h2 :class="heading">{{ t('settings.danger.title') }}</h2>
        <FormMessage tone="warning">{{ t('settings.danger.text') }}</FormMessage>
        <div>
          <BaseButton variant="danger" @click="deleting = true">
            <Trash2 class="h-4 w-4" aria-hidden="true" />
            {{ t('settings.danger.button') }}
          </BaseButton>
        </div>
      </section>
    </div>

    <DeleteAccountDialog :open="deleting" @close="deleting = false" />
  </main>
</template>
