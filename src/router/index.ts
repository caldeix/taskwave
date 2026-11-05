import { createRouter, createWebHistory } from 'vue-router'
import { safeRedirect } from '@/domain/auth'
import { useAuthStore } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    /** Solo sin sesión (login, registro…): con sesión se redirige a la app. */
    guest?: boolean
    /** Requiere sesión iniciada y el correo verificado. */
    requiresAuth?: boolean
    /** Requiere sesión, pero sirve con el correo sin verificar (pantalla de verificación). */
    requiresSession?: boolean
  }
}

// Historial con URL limpias bajo /taskwave/ (D-53). El 404.html de GitHub Pages llega en el step-27.
export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/ShowcaseView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/auth/LoginView.vue'),
      meta: { guest: true },
    },
    {
      path: '/registro',
      name: 'register',
      component: () => import('@/views/auth/RegisterView.vue'),
      meta: { guest: true },
    },
    {
      path: '/recuperar',
      name: 'reset-password',
      component: () => import('@/views/auth/ResetPasswordView.vue'),
      meta: { guest: true },
    },
    {
      path: '/verificar',
      name: 'verify-email',
      component: () => import('@/views/auth/VerifyEmailView.vue'),
      meta: { requiresSession: true },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
    },
  ],
})

/**
 * Guardas de sesión (step-4). En el step-5 se añaden los estados pending/active/blocked.
 * Son solo para la experiencia de uso: la seguridad real está en las reglas de Firestore.
 */
router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  await authStore.whenReady()

  if (!authStore.isLoggedIn) {
    if (to.meta.requiresAuth || to.meta.requiresSession) {
      return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} }
    }
    return true
  }

  if (authStore.mustVerifyEmail) {
    return to.name === 'verify-email' ? true : { name: 'verify-email' }
  }

  if (to.meta.guest || to.name === 'verify-email') {
    return safeRedirect(to.query.redirect) ?? { name: 'home' }
  }
  return true
})
