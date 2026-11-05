<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatHours } from '@/domain/duration'
import { computeProgress } from '@/domain/taskEdit'

/**
 * Horas gastadas sobre el estimado (D-31): barra amarilla (estimado) rellenada en verde (gastado)
 * y, si se pasa, el exceso en coral. Texto «4h de 20h · 20 %».
 */
const props = defineProps<{ spentMin: number; estimateMin: number | null }>()
const { t } = useI18n()

const p = computed(() => computeProgress(props.spentMin, props.estimateMin))
const label = computed(() => {
  const spent = formatHours(props.spentMin)
  if (!p.value.hasEstimate) return t('taskView.hours.noEstimate', { spent })
  const base = t('taskView.hours.ofEstimate', {
    spent,
    estimate: formatHours(props.estimateMin ?? 0),
    percent: p.value.percent,
  })
  return p.value.excessMin > 0
    ? `${base} · ${t('taskView.hours.excess', { excess: formatHours(p.value.excessMin) })}`
    : base
})
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div
      class="relative flex h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
      role="progressbar"
      :aria-valuenow="p.percent ?? undefined"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="label"
    >
      <template v-if="p.hasEstimate">
        <!-- Estimado (amarillo) con lo gastado dentro (verde) -->
        <div class="relative h-full bg-mustard-500" :style="{ width: `${p.estimateWidth}%` }">
          <div
            class="absolute inset-y-0 left-0 bg-emerald-500"
            :style="{ width: `${(p.spentWidth / p.estimateWidth) * 100}%` }"
          />
        </div>
        <!-- Exceso (coral) -->
        <div
          v-if="p.excessWidth > 0"
          class="h-full bg-coral-500"
          :style="{ width: `${p.excessWidth}%` }"
        />
      </template>
      <div v-else-if="spentMin > 0" class="h-full w-full bg-emerald-500" />
    </div>
    <p
      :class="[
        'm-0 font-text text-xs',
        p.excessMin > 0
          ? 'font-bold text-coral-700 dark:text-coral-500'
          : 'text-gray-500 dark:text-gray-400',
      ]"
    >
      {{ label }}
    </p>
  </div>
</template>
