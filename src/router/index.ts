import { createRouter, createWebHistory } from 'vue-router'

// Historial con URL limpias bajo /taskwave/ (D-53). El 404.html de GitHub Pages llega en el step-27.
export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/ShowcaseView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
    },
  ],
})
