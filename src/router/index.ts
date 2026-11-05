import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'
import { resolveAccess, type AccessState } from '@/domain/access'
import { safeRedirect } from '@/domain/auth'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'

declare module 'vue-router' {
  interface RouteMeta {
    /** Solo sin sesión (login, registro…): con sesión se redirige según el estado. */
    guest?: boolean
    /** Requiere una cuenta activa (correo verificado y aprobada por el admin). */
    requiresAuth?: boolean
    /** Pantallas de cuenta (verificar, pendiente, bloqueado): requieren sesión. */
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
      path: '/pendiente',
      name: 'pending',
      component: () => import('@/views/account/AccountStatusView.vue'),
      props: { kind: 'pending' },
      meta: { requiresSession: true },
    },
    {
      path: '/bloqueado',
      name: 'blocked',
      component: () => import('@/views/account/AccountStatusView.vue'),
      props: { kind: 'blocked' },
      meta: { requiresSession: true },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
    },
  ],
})

/** Estado de acceso actual (sesión, verificación y estado del perfil). */
export function currentAccessState(): AccessState {
  const authStore = useAuthStore()
  const profileStore = useProfileStore()
  return {
    loggedIn: authStore.isLoggedIn,
    mustVerifyEmail: authStore.mustVerifyEmail,
    status: profileStore.status,
  }
}

/** Destino de la guarda para una ruta, o `null` si se puede entrar. */
export function guardTarget(to: RouteLocationNormalized) {
  const target = resolveAccess(currentAccessState(), {
    name: typeof to.name === 'string' ? to.name : null,
    guest: to.meta.guest,
    requiresAuth: to.meta.requiresAuth,
    requiresSession: to.meta.requiresSession,
  })
  if (!target) return null
  if (target === 'login') {
    return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} }
  }
  // Al entrar en la app desde el login, se vuelve a la ruta pedida si es interna.
  if (target === 'home' && to.meta.guest) {
    return safeRedirect(to.query.redirect) ?? { name: 'home' }
  }
  return { name: target }
}

/**
 * Guardas por sesión y estado (steps 4 y 5). Solo afectan a la experiencia de uso:
 * la seguridad real está en las reglas de Firestore.
 */
router.beforeEach(async (to) => {
  await useAuthStore().whenReady()
  await useProfileStore().whenLoaded()
  return guardTarget(to) ?? true
})
