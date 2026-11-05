import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  DEFAULT_PREFS,
  buildNewProfile,
  type UserPrefs,
  type UserProfile,
  type UserStatus,
} from '@/domain/profile'
import { useAuthStore } from './auth'

/**
 * Perfil `users/{uid}` del usuario con sesión (step-5).
 * Se crea al primer acceso con el correo verificado (pendiente de aprobación) y se escucha en
 * vivo: cuando el admin aprueba o bloquea, la app reacciona sin recargar.
 */
export const useProfileStore = defineStore('profile', () => {
  const authStore = useAuthStore()

  const profile = ref<UserProfile | null>(null)
  /** UID para el que ya hay perfil cargado (o error). */
  const loadedFor = ref<string | null>(null)
  const error = ref<string | null>(null)

  let unsubscribe: Unsubscribe | null = null
  /** UID para el que se está escuchando o arrancando (evita arranques dobles y carreras). */
  let activeUid: string | null = null
  let waiters: (() => void)[] = []

  const status = computed<UserStatus | 'error' | null>(() => {
    if (error.value) return 'error'
    return profile.value?.status ?? null
  })
  const isAdmin = computed(() => profile.value?.status === 'active' && profile.value.admin === true)

  function markLoaded(uid: string): void {
    loadedFor.value = uid
    waiters.forEach((resolve) => resolve())
    waiters = []
  }

  function stop(): void {
    unsubscribe?.()
    unsubscribe = null
    activeUid = null
    profile.value = null
    loadedFor.value = null
    error.value = null
  }

  async function start(uid: string): Promise<void> {
    stop()
    const user = authStore.user
    if (!user) return
    activeUid = uid
    const ref = doc(db, 'users', uid)
    try {
      // Alta al primer acceso: el perfil nace pendiente (las reglas lo exigen).
      const snapshot = await getDoc(ref)
      if (!snapshot.exists()) await setDoc(ref, buildNewProfile(user, serverTimestamp()))
    } catch (e) {
      if (activeUid !== uid) return // la sesión cambió mientras tanto
      error.value = (e as { code?: string }).code ?? 'unknown'
      markLoaded(uid)
      return
    }
    if (activeUid !== uid) return
    unsubscribe = onSnapshot(
      ref,
      (snap) => {
        profile.value = snap.exists() ? (snap.data() as UserProfile) : null
        error.value = null
        markLoaded(uid)
      },
      (e) => {
        if (activeUid !== uid) return // p. ej. el error que llega al cerrar sesión
        error.value = e.code
        markLoaded(uid)
      },
    )
  }

  /** Arranca o para la escucha según la sesión y la verificación del correo. */
  watch(
    () => [authStore.user?.uid ?? null, authStore.mustVerifyEmail] as const,
    ([uid, mustVerify]) => {
      if (uid && !mustVerify) {
        if (activeUid !== uid) void start(uid)
      } else if (activeUid) {
        stop()
      }
    },
    { immediate: true },
  )

  /** Espera a que el perfil del usuario actual esté cargado (lo usan las guardas). */
  function whenLoaded(): Promise<void> {
    const uid = authStore.user?.uid
    if (!uid || authStore.mustVerifyEmail || loadedFor.value === uid) return Promise.resolve()
    return new Promise((resolve) => waiters.push(resolve))
  }

  /** Reintenta tras un error (p. ej. sin conexión). */
  async function retry(): Promise<void> {
    const uid = authStore.user?.uid
    if (uid) await start(uid)
  }

  /** Preferencias con los valores por defecto para lo que falte. */
  const prefs = computed<UserPrefs>(() => ({ ...DEFAULT_PREFS, ...(profile.value?.prefs ?? {}) }))

  /**
   * Guarda preferencias en `users/{uid}.prefs` (solo cuentas activas, según las reglas).
   * Solo escribe si cambia algo, para no gastar escrituras.
   */
  async function updatePrefs(patch: Partial<UserPrefs>): Promise<void> {
    const uid = authStore.user?.uid
    if (!uid || profile.value?.status !== 'active') return
    const changes = Object.fromEntries(
      Object.entries(patch)
        .filter(([key, value]) => prefs.value[key as keyof UserPrefs] !== value)
        .map(([key, value]) => [`prefs.${key}`, value]),
    )
    if (Object.keys(changes).length > 0) await updateDoc(doc(db, 'users', uid), changes)
  }

  return { profile, status, isAdmin, error, loadedFor, prefs, whenLoaded, retry, updatePrefs }
})
