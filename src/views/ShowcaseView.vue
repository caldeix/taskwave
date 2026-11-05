<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/ui/BaseButton.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'
import { TASK_STATUSES } from '@/domain/status'

// Página provisional del step-2: se sustituirá por el layout real en el step-8.
const { t } = useI18n()
const titleClass =
  'm-0 w-fit max-w-full bg-radial-blue bg-clip-text font-title leading-tight font-semibold text-balance text-transparent'
</script>

<template>
  <main class="container mx-auto flex flex-col gap-12 px-4 py-10">
    <header class="flex flex-col gap-3">
      <div class="flex items-start justify-between gap-4">
        <h1 :class="[titleClass, 'text-5xl']">{{ t('app.name') }}</h1>
        <ThemeToggle />
      </div>
      <p class="m-0 text-base leading-relaxed text-gray-500 dark:text-gray-400">
        {{ t('app.tagline') }}
      </p>
    </header>

    <section class="flex flex-col gap-4">
      <h2 :class="[titleClass, 'text-4xl']">{{ t('showcase.title') }}</h2>
      <p class="m-0 text-sm leading-normal text-gray-500 dark:text-gray-400">
        {{ t('showcase.intro') }}
      </p>

      <h3 :class="[titleClass, 'text-3xl']">{{ t('showcase.buttons') }}</h3>
      <div class="flex flex-wrap items-center gap-3">
        <BaseButton variant="primary">{{ t('showcase.primary') }}</BaseButton>
        <BaseButton variant="secondary">{{ t('showcase.secondary') }}</BaseButton>
        <BaseButton variant="success">{{ t('showcase.success') }}</BaseButton>
        <BaseButton variant="danger">{{ t('showcase.danger') }}</BaseButton>
        <BaseButton variant="ghost">{{ t('showcase.ghost') }}</BaseButton>
        <BaseButton disabled>{{ t('showcase.disabled') }}</BaseButton>
      </div>

      <h3 :class="[titleClass, 'text-3xl']">{{ t('showcase.statuses') }}</h3>
      <div class="flex flex-wrap items-center gap-3">
        <StatusBadge v-for="status in TASK_STATUSES" :key="status" :status="status" />
      </div>
    </section>
  </main>
</template>
