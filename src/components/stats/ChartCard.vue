<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/**
 * Tarjeta de un gráfico (step-23): título, nota, el gráfico y, plegada, su tabla con todos los
 * valores (para quien no ve el gráfico o prefiere leer números).
 */
defineProps<{ title: string; subtitle?: string; rows?: [string, string][] }>()
const { t } = useI18n()
</script>

<template>
  <section
    class="flex min-w-0 flex-col gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
  >
    <header class="flex flex-col gap-0.5">
      <h2 class="m-0 font-text text-base font-bold text-gray-800 dark:text-white">{{ title }}</h2>
      <p v-if="subtitle" class="m-0 font-text text-sm text-gray-500 dark:text-gray-400">
        {{ subtitle }}
      </p>
    </header>
    <slot />
    <details v-if="rows && rows.length" class="font-text text-sm">
      <summary
        class="cursor-pointer text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-blue-400"
      >
        {{ t('stats.table') }}
      </summary>
      <table class="mt-2 w-full border-collapse">
        <tbody>
          <tr
            v-for="([label, value], i) in rows"
            :key="i"
            class="border-b border-gray-200 dark:border-gray-700"
          >
            <th class="py-1 pr-3 text-left font-normal text-gray-500 dark:text-gray-400">
              {{ label }}
            </th>
            <td class="py-1 text-right text-gray-800 tabular-nums dark:text-white">{{ value }}</td>
          </tr>
        </tbody>
      </table>
    </details>
  </section>
</template>
