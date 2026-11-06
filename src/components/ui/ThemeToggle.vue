<script setup lang="ts">
import { Moon, Sun } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import IconButton from './IconButton.vue'
import { useThemeChoice } from '@/composables/useThemeSync'

const { t } = useI18n()
// Con sesión, el cambio se guarda en el perfil (step-25); sin sesión, solo en este navegador.
const { isDark, toggle } = useThemeChoice()
</script>

<template>
  <IconButton :label="t('theme.toggle')" :aria-pressed="isDark" @click="toggle">
    <Sun v-if="isDark" class="h-5 w-5 shrink-0" aria-hidden="true" />
    <Moon v-else class="h-5 w-5 shrink-0" aria-hidden="true" />
  </IconButton>
</template>
