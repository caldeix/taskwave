import { initializeApp } from 'firebase/app'
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
