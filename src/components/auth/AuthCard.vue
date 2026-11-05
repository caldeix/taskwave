<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'

/** Marco común de las pantallas de acceso: marca, título y tarjeta centrada. */
defineProps<{ title: string; subtitle?: string }>()
const { t } = useI18n()
</script>

<template>
  <main class="flex min-h-dvh flex-col px-4 py-6">
    <div class="flex justify-end">
      <ThemeToggle />
    </div>
    <div class="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 py-8">
      <p
        class="m-0 w-fit bg-radial-blue bg-clip-text font-title text-5xl leading-tight font-semibold text-transparent"
      >
        {{ t('app.name') }}
      </p>
      <!-- Tarjeta con borde del DS: los campos ya tienen fondo gris, así que la tarjeta no lo lleva -->
      <section
        class="flex min-w-0 flex-col gap-6 rounded-lg border border-gray-500 p-6 dark:border-gray-400"
      >
        <header class="flex flex-col gap-1">
          <h1
            class="m-0 font-title text-3xl leading-tight font-semibold text-gray-800 dark:text-white"
          >
            {{ title }}
          </h1>
          <p
            v-if="subtitle"
            class="m-0 font-text text-sm leading-normal text-gray-500 dark:text-gray-400"
          >
            {{ subtitle }}
          </p>
        </header>
        <slot />
      </section>
      <slot name="footer" />
    </div>
  </main>
</template>
