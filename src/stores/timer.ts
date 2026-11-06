import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { TimerRunningError, startTimer, stopTimer, type StopResult } from '@/data/timer'
import { tasksCollection } from '@/data/taskQueries'
import { formatHours } from '@/domain/duration'
import { isClosedStatus } from '@/domain/status'
import { taskFromData, type Task } from '@/domain/task'
import { formatClock, isOverWarning } from '@/domain/timer'
import { i18n } from '@/i18n'
import { db } from '@/lib/firebase'
import { useAuthStore } from './auth'
import { useProfileStore } from './profile'
import { useTasksStore } from './tasks'
import { useToastsStore } from './toasts'

function millis(value: unknown): number | null {
  return value && typeof (value as { toMillis?: unknown }).toMillis === 'function'
    ? (value as { toMillis: () => number }).toMillis()
    : null
}

const BASE_TITLE = 'TaskWave'

/**
 * Cronómetro de la app (step-19, D-25 a D-28): uno solo, leído del perfil en vivo, así que se
 * ve igual en todas las pestañas y dispositivos. Cuenta cada segundo mientras está en marcha,
 * muestra el tiempo en el título de la pestaña y avisa a partir de las horas configuradas.
 */
export const useTimerStore = defineStore('timer', () => {
  const authStore = useAuthStore()
  const profileStore = useProfileStore()

  const active = computed(() => {
    const timer = profileStore.profile?.activeTimer
    const startedAtMs = timer ? millis(timer.startedAt) : null
    return timer && startedAtMs !== null ? { taskId: timer.taskId, startedAtMs } : null
  })

  // ---------------------------------------------------------------- reloj
  const now = ref(Date.now())
  let ticker: ReturnType<typeof setInterval> | undefined
  watch(
    () => active.value !== null,
    (running) => {
      clearInterval(ticker)
      now.value = Date.now()
      if (running) ticker = setInterval(() => (now.value = Date.now()), 1000)
    },
    { immediate: true },
  )

  const elapsedMs = computed(() =>
    active.value ? Math.max(0, now.value - active.value.startedAtMs) : 0,
  )
  const clock = computed(() => formatClock(elapsedMs.value))
  const warnHours = computed(() => profileStore.prefs.timerWarnHours)
  const overWarning = computed(
    () => active.value !== null && isOverWarning(elapsedMs.value, warnHours.value),
  )

  // ---------------------------------------------------------------- tarea en marcha
  const task = shallowRef<Task | null>(null)
  let stopTask: Unsubscribe | null = null
  watch(
    () => [authStore.user?.uid ?? null, active.value?.taskId ?? null] as const,
    ([uid, taskId]) => {
      stopTask?.()
      stopTask = null
      task.value = null
      if (!uid || !taskId) return
      stopTask = onSnapshot(
        doc(tasksCollection(db, uid), taskId),
        (snap) => (task.value = snap.exists() ? taskFromData(snap.id, snap.data()) : null),
        () => (task.value = null),
      )
    },
    { immediate: true },
  )

  // Título de la pestaña: «⏱ 1:05:07 · EST-12 — TaskWave».
  watch(
    [clock, active, task],
    () => {
      document.title = active.value
        ? `⏱ ${clock.value}${task.value ? ` · ${task.value.key}` : ''} — ${BASE_TITLE}`
        : BASE_TITLE
    },
    { immediate: true },
  )

  // ---------------------------------------------------------------- acciones
  function requireUid(): string {
    const uid = authStore.user?.uid
    if (!uid) throw new Error('Sin sesión')
    return uid
  }

  /** Inicia el cronómetro. Si ya hay otro, falla con `TimerRunningError`. */
  async function start(taskId: string): Promise<void> {
    await startTimer(db, requireUid(), taskId)
    now.value = Date.now()
  }

  /** Para el cronómetro y registra las horas; `endMs` = hora de fin elegida (D-28). */
  function stop(endMs?: number): Promise<StopResult | null> {
    return stopTimer(db, requireUid(), endMs)
  }

  function isRunningOn(taskId: string): boolean {
    return active.value?.taskId === taskId
  }

  // ---------------------------------------------------------------- flujo con avisos
  // Los diálogos están en `TimerDialogs` (montado una vez en el layout) y leen `pending`.
  const t = i18n.global.t
  const pending = shallowRef<{ kind: 'switch'; task: Task } | { kind: 'stop' } | null>(null)
  const busy = ref(false)

  function toastStop(result: StopResult | null, key: string | undefined): void {
    const toasts = useToastsStore()
    if (!result) return
    if (result.minutes === 0) toasts.show(t('timer.nothingLogged'), 'warning')
    else
      toasts.show(
        t(
          'timer.logged',
          { hours: formatHours(result.minutes), key: key ?? '', n: result.worklogs },
          result.worklogs,
        ),
      )
  }

  /** Inicia en la tarea; pasa a «En curso» si estaba pendiente o paralizada (D-17). */
  async function doStart(target: Task): Promise<void> {
    await start(target.id)
    if (target.status === 'pending' || target.status === 'paused')
      await useTasksStore().setStatus(target, 'in_progress')
  }

  /**
   * Botón «Iniciar»: si hay otro cronómetro en marcha, pide confirmación para pararlo (D-25).
   * Las tareas cerradas no se cronometran (hay que reabrirlas).
   */
  async function requestStart(target: Task): Promise<void> {
    if (busy.value || isClosedStatus(target.status) || isRunningOn(target.id)) return
    if (active.value) {
      pending.value = { kind: 'switch', task: target }
      return
    }
    busy.value = true
    try {
      await doStart(target)
    } catch (e) {
      if (e instanceof TimerRunningError) pending.value = { kind: 'switch', task: target }
      else useToastsStore().show(t('timer.failed'), 'error')
    } finally {
      busy.value = false
    }
  }

  /** «Parar»: si lleva más de las horas de aviso, pregunta la hora de fin (D-28). */
  async function requestStop(): Promise<void> {
    if (busy.value || !active.value) return
    if (overWarning.value) {
      pending.value = { kind: 'stop' }
      return
    }
    await confirmStop()
  }

  async function confirmStop(endMs?: number): Promise<boolean> {
    busy.value = true
    const key = task.value?.key
    try {
      toastStop(await stop(endMs), key)
      pending.value = null
      return true
    } catch {
      useToastsStore().show(t('timer.failed'), 'error')
      return false
    } finally {
      busy.value = false
    }
  }

  /** Para el cronómetro actual (registrando sus horas) y empieza en la otra tarea. */
  async function confirmSwitch(): Promise<void> {
    const next = pending.value?.kind === 'switch' ? pending.value.task : null
    if (!next) return
    busy.value = true
    const key = task.value?.key
    try {
      toastStop(await stop(), key)
      await doStart(next)
      pending.value = null
    } catch {
      useToastsStore().show(t('timer.failed'), 'error')
    } finally {
      busy.value = false
    }
  }

  function cancelPending(): void {
    pending.value = null
  }

  // Aviso de cronómetro olvidado (D-28), una vez por cronómetro.
  let warnedFor: number | null = null
  watch(overWarning, (over) => {
    if (!over || !active.value || warnedFor === active.value.startedAtMs) return
    warnedFor = active.value.startedAtMs
    useToastsStore().show(t('timer.warning', { hours: warnHours.value }), 'warning', 15000)
  })

  return {
    active,
    elapsedMs,
    clock,
    warnHours,
    overWarning,
    task,
    start,
    stop,
    isRunningOn,
    pending,
    busy,
    requestStart,
    requestStop,
    confirmStop,
    confirmSwitch,
    cancelPending,
  }
})
