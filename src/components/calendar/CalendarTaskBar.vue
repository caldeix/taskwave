<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DayKey } from '@/domain/dates'
import { isClosedStatus, STATUS_STYLES } from '@/domain/status'
import type { WeekSegment } from '@/domain/calendar'
import { useTaskDrag } from '@/composables/useTaskDrag'

/**
 * Barra de una tarea en el calendario (D-20): ocupa sus días de la semana y se puede arrastrar
 * a otro día (D-21). El color es el de su estado; las cerradas se ven atenuadas.
 */
const props = defineProps<{ segment: WeekSegment; week: DayKey[] }>()
const emit = defineEmits<{ open: [] }>()

const { t } = useI18n()
const { start, end } = useTaskDrag()

const task = computed(() => props.segment.task)
const closed = computed(() => isClosedStatus(task.value.status))
const label = computed(
  () =>
    `${task.value.key} ${task.value.title} · ${t(`status.${task.value.status}`)}` +
    (task.value.endDate ? ` · ${task.value.startDate} → ${task.value.endDate}` : ''),
)

/** Día de la barra por el que se coge, según la posición del ratón. */
function onDragStart(event: DragEvent): void {
  const el = event.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const offset = Math.min(
    props.segment.span - 1,
    Math.max(0, Math.floor(((event.clientX - rect.left) / rect.width) * props.segment.span)),
  )
  start(event, task.value, props.week[props.segment.col + offset] ?? null)
}
</script>

<template>
  <button
    type="button"
    draggable="true"
    :title="label"
    :aria-label="label"
    :class="[
      'pointer-events-auto mx-0.5 flex h-5.5 min-w-0 cursor-grab items-center gap-1 overflow-hidden border-0 px-1.5 text-left font-text text-xs font-medium transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 active:cursor-grabbing',
      STATUS_STYLES[task.status].badge,
      segment.continuesBefore ? 'rounded-l-none' : 'rounded-l-md',
      segment.continuesAfter ? 'rounded-r-none' : 'rounded-r-md',
      closed ? 'opacity-60' : '',
      task.status === 'discarded' ? 'line-through' : '',
    ]"
    :style="{ gridColumn: `${segment.col + 1} / span ${segment.span}`, gridRow: segment.lane + 2 }"
    @dragstart="onDragStart"
    @dragend="end"
    @click.stop="emit('open')"
  >
    <span class="shrink-0 font-bold">{{ task.key }}</span>
    <span class="truncate">{{ task.title }}</span>
  </button>
</template>
