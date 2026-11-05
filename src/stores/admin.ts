import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { actionPatch, type AdminUserRow, type UserAction } from '@/domain/adminUsers'
import { useAuthStore } from './auth'
import { useProfileStore } from './profile'

function toMillis(value: unknown): number | null {
  return value && typeof (value as { toMillis?: unknown }).toMillis === 'function'
    ? (value as { toMillis: () => number }).toMillis()
    : null
}

function toRow(snap: QueryDocumentSnapshot<DocumentData>): AdminUserRow {
  // `estimate`: un alta recién creada muestra la hora local hasta que confirma el servidor.
  const data = snap.data({ serverTimestamps: 'estimate' })
  return {
    uid: snap.id,
    email: String(data.email ?? ''),
    displayName: String(data.displayName ?? ''),
    provider: String(data.provider ?? 'password'),
    status: data.status,
    admin: data.admin === true,
    createdAtMs: toMillis(data.createdAt),
    approvedAtMs: toMillis(data.approvedAt),
  }
}

/**
 * Datos del panel de administración (step-7). Las reglas solo dejan listar perfiles al admin.
 * - `pendingCount`: se escucha siempre que la sesión es de un admin (contador del menú, D-9).
 * - `users`: solo mientras el panel está abierto, para no gastar lecturas (`openList`/`closeList`).
 */
export const useAdminStore = defineStore('admin', () => {
  const authStore = useAuthStore()
  const profileStore = useProfileStore()

  const pendingCount = ref(0)
  const users = ref<AdminUserRow[]>([])
  const listLoading = ref(false)
  const listError = ref<string | null>(null)

  let stopPending: Unsubscribe | null = null
  let stopList: Unsubscribe | null = null

  watch(
    () => profileStore.isAdmin,
    (isAdmin) => {
      stopPending?.()
      stopPending = null
      pendingCount.value = 0
      if (!isAdmin) {
        closeList()
        return
      }
      stopPending = onSnapshot(
        query(collection(db, 'users'), where('status', '==', 'pending')),
        (snap) => (pendingCount.value = snap.size),
        () => (pendingCount.value = 0),
      )
    },
    { immediate: true },
  )

  function openList(): void {
    if (stopList || !profileStore.isAdmin) return
    listLoading.value = true
    listError.value = null
    stopList = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        users.value = snap.docs.map(toRow)
        listLoading.value = false
      },
      (e) => {
        listError.value = e.code
        listLoading.value = false
      },
    )
  }

  function closeList(): void {
    stopList?.()
    stopList = null
    users.value = []
  }

  async function applyAction(user: AdminUserRow, action: UserAction): Promise<void> {
    const adminUid = authStore.user?.uid
    if (!adminUid) return
    await updateDoc(
      doc(db, 'users', user.uid),
      actionPatch(action, user, adminUid, serverTimestamp()),
    )
  }

  return { pendingCount, users, listLoading, listError, openList, closeList, applyAction }
})
