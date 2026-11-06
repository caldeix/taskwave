import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type ActionCodeSettings,
  type User,
} from 'firebase/auth'
import { deleteAccountData } from '@/data/account'
import { auth, clearLocalData, db } from '@/lib/firebase'
import { isUserNotFound, needsEmailVerification } from '@/domain/auth'

// Los correos de Firebase (verificación y recuperación) salen en español.
auth.languageCode = 'es'

/** Tras pulsar el enlace del correo, Firebase devuelve al usuario al login de la app. */
function actionCodeSettings(): ActionCodeSettings {
  return { url: `${window.location.origin}${import.meta.env.BASE_URL}login` }
}

/**
 * Sesión de Firebase Auth (step-4). El perfil de Firestore, los estados pending/active/blocked
 * y sus pantallas llegan en el step-5.
 */
export const useAuthStore = defineStore('auth', () => {
  const user = shallowRef<User | null>(null)
  const ready = ref(false)
  /** Se incrementa al recargar el usuario, porque `User` muta por dentro sin avisar a Vue. */
  const version = ref(0)

  let resolveReady!: () => void
  const readyPromise = new Promise<void>((resolve) => (resolveReady = resolve))

  onAuthStateChanged(auth, (next) => {
    user.value = next
    version.value++
    if (!ready.value) {
      ready.value = true
      resolveReady()
    }
  })

  const isLoggedIn = computed(() => user.value !== null)
  const mustVerifyEmail = computed(() => {
    void version.value
    return user.value !== null && needsEmailVerification(user.value)
  })

  /** Espera a que Firebase diga si hay sesión (lo usan las guardas del router). */
  function whenReady(): Promise<void> {
    return readyPromise
  }

  async function loginWithEmail(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(auth, email.trim(), password)
  }

  async function registerWithEmail(name: string, email: string, password: string): Promise<void> {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
    await updateProfile(cred.user, { displayName: name.trim() })
    await sendEmailVerification(cred.user, actionCodeSettings())
    version.value++
  }

  async function loginWithGoogle(): Promise<void> {
    // Ventana emergente y no redirección: la app (github.io) y authDomain son dominios distintos.
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    await signInWithPopup(auth, provider)
  }

  async function sendPasswordReset(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email.trim(), actionCodeSettings())
    } catch (error) {
      if (!isUserNotFound(error)) throw error
    }
  }

  async function resendVerification(): Promise<void> {
    if (user.value) await sendEmailVerification(user.value, actionCodeSettings())
  }

  /** Vuelve a pedir el usuario a Firebase (p. ej. tras verificar el correo en otra pestaña). */
  async function refreshUser(): Promise<void> {
    if (!user.value) return
    await reload(user.value)
    await user.value.getIdToken(true)
    version.value++
  }

  /**
   * Cierra la sesión, borra la caché local de Firestore (privacidad en equipos compartidos) y
   * recarga en el login, porque Firestore queda inutilizable tras borrar su caché.
   */
  /** ¿Entra con contraseña? (si no, con Google). Para pedir la confirmación adecuada. */
  const usesPassword = computed(
    () => user.value?.providerData.some((p) => p.providerId === 'password') ?? false,
  )

  /**
   * Vuelve a pedir la identidad antes de algo delicado (la baja, P-9): Firebase exige un inicio
   * de sesión reciente para `deleteUser`. Con contraseña o con la ventana de Google.
   */
  async function reauthenticate(password?: string): Promise<void> {
    const current = auth.currentUser
    if (!current) throw new Error('Sin sesión')
    if (usesPassword.value)
      await reauthenticateWithCredential(
        current,
        EmailAuthProvider.credential(current.email ?? '', password ?? ''),
      )
    else await reauthenticateWithPopup(current, new GoogleAuthProvider())
  }

  /**
   * Baja de la cuenta (step-25, P-9): borra todos los datos (el perfil el último), después la
   * cuenta de Auth y la caché local, y vuelve al login. Llamar después de `reauthenticate`.
   */
  async function deleteAccount(): Promise<void> {
    const current = auth.currentUser
    if (!current) throw new Error('Sin sesión')
    await deleteAccountData(db, current.uid)
    await deleteUser(current)
    await clearLocalData()
    window.location.replace(`${import.meta.env.BASE_URL}login?baja=1`)
  }

  async function logout(): Promise<void> {
    await signOut(auth)
    await clearLocalData()
    window.location.replace(`${import.meta.env.BASE_URL}login`)
  }

  return {
    user,
    ready,
    version,
    isLoggedIn,
    mustVerifyEmail,
    whenReady,
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
    sendPasswordReset,
    resendVerification,
    refreshUser,
    logout,
    usesPassword,
    reauthenticate,
    deleteAccount,
  }
})
