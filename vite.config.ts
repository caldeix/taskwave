/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// La app se publica en GitHub Pages bajo caldeix.github.io/taskwave (D-54).
export default defineConfig({
  base: '/taskwave/',
  plugins: [
    vue(),
    tailwindcss(),
    // PWA instalable que abre sin conexión (step-26, D-50). `prompt`: una versión nueva no se
    // aplica sola; la app avisa y el usuario recarga (R-14). Los datos sin conexión los da la
    // caché de Firestore (IndexedDB), no el service worker.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'TaskWave',
        short_name: 'TaskWave',
        description: 'Gestor de tareas personales con calendario, kanban y registro de horas.',
        lang: 'es',
        theme_color: '#2563eb',
        background_color: '#111827',
        display: 'standalone',
        start_url: '/taskwave/',
        scope: '/taskwave/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Se precachea la app y solo las fuentes latinas; el resto de alfabetos, al usarse.
        globPatterns: [
          '**/*.{js,css,html,svg,png,ico}',
          '**/*-latin-*.woff2',
          '**/*-latin-ext-*.woff2',
        ],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 40 } },
          },
        ],
      },
    }),
  ],
  // Versión de la app (package.json), que se ve en Ajustes (step-25).
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    // Los días van en hora local (como en la app); en los tests, siempre la de Madrid.
    env: { TZ: 'Europe/Madrid' },
  },
})
