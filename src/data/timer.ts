import {
  Timestamp,
  collection,
  doc,
  increment,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore'
import { clampStop, splitByDay, totalMinutes } from '@/domain/timer'
import { tasksCollection } from './taskQueries'

/**
 * Cronómetro (step-19, D-25 a D-28). Vive en el perfil (`activeTimer`), así que sigue
 * contando aunque se recargue o se cierre la pestaña, y se ve en otros dispositivos.
 * Iniciar y parar van en transacción: necesitan conexión.
 */

export class TimerRunningError extends Error {
  constructor(public readonly taskId: string) {
    super('timer-running')
  }
}

/**
 * Inicia el cronómetro en una tarea con la hora del servidor (las reglas lo exigen).
 * Si ya hay uno en marcha, falla con `TimerRunningError`: hay que pararlo antes (D-25).
 */
export async function startTimer(db: Firestore, uid: string, taskId: string): Promise<void> {
  const profileRef = doc(db, 'users', uid)
  await runTransaction(db, async (tx) => {
    const profile = await tx.get(profileRef)
    const current = profile.data()?.activeTimer as { taskId: string } | null | undefined
    if (current) throw new TimerRunningError(current.taskId)
    tx.update(profileRef, { activeTimer: { taskId, startedAt: serverTimestamp() } })
  })
}

export interface StopResult {
  taskId: string
  minutes: number
  /** Registros creados: más de uno si pasó de medianoche (D-27). */
  worklogs: number
}

/**
 * Para el cronómetro: crea un registro de horas por día, suma los minutos a la tarea
 * (`spentMin` con `increment`, y `lastWorkedAt`) y quita el cronómetro, todo a la vez.
 * `endMs` es la hora de fin elegida para un cronómetro olvidado (D-28); por defecto, ahora.
 * Si la tarea ya no existe, solo se quita el cronómetro. Devuelve `null` si no había ninguno.
 */
export async function stopTimer(
  db: Firestore,
  uid: string,
  endMs?: number,
): Promise<StopResult | null> {
  const profileRef = doc(db, 'users', uid)
  return runTransaction(db, async (tx) => {
    const profile = await tx.get(profileRef)
    const timer = profile.data()?.activeTimer as
      { taskId: string; startedAt: Timestamp } | null | undefined
    if (!timer) return null

    const taskRef = doc(tasksCollection(db, uid), timer.taskId)
    const task = await tx.get(taskRef)
    const startMs = timer.startedAt.toMillis()
    const end = clampStop(startMs, endMs ?? Date.now())
    const segments = task.exists() ? splitByDay(startMs, end) : []
    const minutes = totalMinutes(segments)

    for (const segment of segments)
      tx.set(doc(collection(db, 'users', uid, 'worklogs')), {
        taskId: timer.taskId,
        projectId: (task.data()?.projectId as string | null) ?? null,
        date: segment.date,
        minutes: segment.minutes,
        startedAt: Timestamp.fromMillis(segment.startMs),
        endedAt: Timestamp.fromMillis(segment.endMs),
        source: 'timer',
        note: '',
      })
    if (minutes > 0)
      tx.update(taskRef, {
        spentMin: increment(minutes),
        lastWorkedAt: Timestamp.fromMillis(end),
        updatedAt: serverTimestamp(),
      })
    tx.update(profileRef, { activeTimer: null })
    return { taskId: timer.taskId, minutes, worklogs: segments.length }
  })
}
