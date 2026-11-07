/// <reference types="vitest/config" />
import { createHash } from 'node:crypto'
import { copyFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }
import { buildCsp, inlineScripts } from './src/lib/csp'

/**
 * Producción en GitHub Pages (step-27, D-4, D-53, R-3):
 * - CSP en un `<meta>` (Pages no deja enviar cabeceras), con el hash de cada script en línea.
 * - `404.html` = copia de `index.html`: Pages lo sirve para cualquier ruta que no existe
 *   (`/taskwave/t/EST-12`), carga la app y el router muestra la ruta pedida.
 */
function githubPages(authDomain: string, withCsp: boolean): Plugin {
  let outDir = 'dist'
  return {
    name: 'taskwave-github-pages',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (!withCsp) return html
        const hashes = inlineScripts(html).map(
          (code) => `sha256-${createHash('sha256').update(code).digest('base64')}`,
        )
        const meta = `<meta http-equiv="Content-Security-Policy" content="${buildCsp({ authDomain, scriptHashes: hashes })}" />`
        return html.replace(/(<meta charset="UTF-8" \/>)/, `$1\n    ${meta}`)
      },
    },
    closeBundle() {
      copyFileSync(`${outDir}/index.html`, `${outDir}/404.html`)
    },
  }
}

// La app se publica en GitHub Pages bajo caldeix.github.io/taskwave (D-54).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // Con los emuladores (127.0.0.1) no se pone la CSP: es solo para producción.
  const production = mode === 'production' && env.VITE_USE_EMULATORS !== 'true'
  return {
    base: '/taskwave/',
    plugins: [
      vue(),
      tailwindcss(),
      githubPages(env.VITE_FIREBASE_AUTH_DOMAIN ?? '', production),
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
  }
})
