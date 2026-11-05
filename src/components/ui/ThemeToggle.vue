<script setup lang="ts">
import { Moon, Sun } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import IconButton from './IconButton.vue'
import { useTheme } from '@/composables/useTheme'

const { t } = useI18n()
const { isDark, toggle } = useTheme()
</script>

<template>
  <IconButton :label="t('theme.toggle')" :aria-pressed="isDark" @click="toggle">
    <Sun v-if="isDark" class="h-5 w-5 shrink-0" aria-hidden="true" />
    <Moon v-else class="h-5 w-5 shrink-0" aria-hidden="true" />
  </IconButton>
</template>
