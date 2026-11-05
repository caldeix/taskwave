<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/ui/BaseButton.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { TASK_STATUSES } from '@/domain/status'

// Muestra del DS dentro de la app (solo enlazada en desarrollo, en `/ds`).
const { t } = useI18n()
const titleClass =
  'm-0 w-fit max-w-full bg-radial-blue bg-clip-text font-title leading-tight font-semibold text-balance text-transparent'
</script>

<template>
  <main class="flex flex-col gap-6 px-4 py-6 md:px-8">
    <h1 :class="[titleClass, 'text-4xl']">{{ t('showcase.title') }}</h1>
    <p class="m-0 text-sm leading-normal text-gray-500 dark:text-gray-400">
      {{ t('showcase.intro') }}
    </p>

    <h2 :class="[titleClass, 'text-3xl']">{{ t('showcase.buttons') }}</h2>
    <div class="flex flex-wrap items-center gap-3">
      <BaseButton variant="primary">{{ t('showcase.primary') }}</BaseButton>
      <BaseButton variant="secondary">{{ t('showcase.secondary') }}</BaseButton>
      <BaseButton variant="success">{{ t('showcase.success') }}</BaseButton>
      <BaseButton variant="danger">{{ t('showcase.danger') }}</BaseButton>
      <BaseButton variant="ghost">{{ t('showcase.ghost') }}</BaseButton>
      <BaseButton disabled>{{ t('showcase.disabled') }}</BaseButton>
    </div>

    <h2 :class="[titleClass, 'text-3xl']">{{ t('showcase.statuses') }}</h2>
    <div class="flex flex-wrap items-center gap-3">
      <StatusBadge v-for="status in TASK_STATUSES" :key="status" :status="status" />
    </div>
  </main>
</template>
