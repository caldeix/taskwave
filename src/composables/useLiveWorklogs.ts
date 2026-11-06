import { onScopeDispose, shallowRef, watch } from 'vue'
import { onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { worklogsInRangeQuery } from '@/data/stats'
import type { DayRange } from '@/domain/dates'
import { worklogFromData, type Worklog } from '@/domain/worklog'
import { db } from '@/lib/firebase'

/**
 * Registros de horas de un rango de días, en vivo (horas de cada día del calendario, step-24).
 * `source` devuelve `null` para no escuchar nada (por ejemplo, en la vista kanban).
 */
export function useLiveWorklogs(source: () => { uid: string; range: DayRange } | null) {
  const logs = shallowRef<Worklog[]>([])
  let stop: Unsubscribe | null = null

  watch(
    () => {
      const s = source()
      return s ? `${s.uid}:${s.range.from}:${s.range.to}` : null
    },
    () => {
      stop?.()
      stop = null
      logs.value = []
      const s = source()
      if (!s) return
      stop = onSnapshot(
        worklogsInRangeQuery(db, s.uid, s.range),
        (snap) => (logs.value = snap.docs.map((d) => worklogFromData(d.id, d.data()))),
        () => (logs.value = []),
      )
    },
    { immediate: true },
  )

  onScopeDispose(() => stop?.())
  return logs
}
