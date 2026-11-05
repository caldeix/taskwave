<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <main class="mx-auto flex max-w-md flex-col items-start gap-4 px-4 py-16">
    <h1
      class="m-0 w-fit bg-radial-blue bg-clip-text font-title text-4xl leading-tight font-semibold text-transparent"
    >
      {{ t('notFound.title') }}
    </h1>
    <RouterLink to="/" class="font-text font-bold text-blue-600 no-underline">
      {{ t('notFound.back') }}
    </RouterLink>
  </main>
</template>
