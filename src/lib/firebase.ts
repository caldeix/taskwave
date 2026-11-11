import { initializeApp } from 'firebase/app'
import { ReCaptchaEnterpriseProvider, initializeAppCheck } from 'firebase/app-check'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import {
  clearIndexedDbPersistence,
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
} from 'firebase/firestore'

/**
 * Inicialización única de Firebase.
 * Con `npm run dev:emu` (modo `emulator`) se conecta a la Emulator Suite local con el proyecto
 * `demo-taskwave`: los proyectos `demo-*` no existen en Google, así que nada sale del equipo
 * ni gasta cuota (D-5).
 */
export const usingEmulators = import.meta.env.VITE_USE_EMULATORS === 'true'

export const firebaseApp = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})

/**
 * App Check (step-27, D-3): cada petición a Firebase lleva un token que demuestra que sale de
 * esta web, así que las llamadas desde scripts u otras webs se rechazan cuando se activa la
 * obligatoriedad en la consola. Va antes que Auth y Firestore.
 * - Proveedor: reCAPTCHA Enterprise, que en Google Cloud se llama «Fraud Defense» (el reCAPTCHA
 *   clásico v3 está obsoleto en App Check). Clave de sitio en `VITE_APPCHECK_SITE_KEY` (pública).
 * - Sin clave (`VITE_APPCHECK_SITE_KEY` vacía) o con los emuladores, no se activa.
 * - En desarrollo usa un token de depuración (se registra en la consola de Firebase):
 *   `VITE_APPCHECK_DEBUG_TOKEN` o, si no hay, uno que el SDK muestra en la consola del navegador.
 */
const appCheckSiteKey = import.meta.env.VITE_APPCHECK_SITE_KEY
if (!usingEmulators && appCheckSiteKey) {
  if (import.meta.env.DEV)
    (self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true
  initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  })
}

export const auth = getAuth(firebaseApp)

/**
 * Caché persistente en IndexedDB (step-9, D-50): la app funciona sin conexión y, al volver,
 * Firestore solo trae lo que ha cambiado, así que se leen muchos menos documentos.
 * Varias pestañas comparten la misma caché.
 */
export const db = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

if (usingEmulators) {
  const host = import.meta.env.VITE_EMULATOR_HOST || '127.0.0.1'
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true })
  connectFirestoreEmulator(db, host, 8080)
}

/**
 * Borra la caché local de Firestore (al cerrar sesión), para que en un equipo compartido no
 * queden los datos del usuario en el navegador. Deja Firestore inutilizable: después hay que
 * recargar la página.
 */
export async function clearLocalData(): Promise<void> {
  try {
    await terminate(db)
    await clearIndexedDbPersistence(db)
  } catch {
    // Otra pestaña sigue usando la caché: se borrará cuando se cierre sesión en la última.
  }
}
