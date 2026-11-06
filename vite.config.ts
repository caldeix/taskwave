/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import pkg from './package.json' with { type: 'json' }

// La app se publica en GitHub Pages bajo caldeix.github.io/taskwave (D-54).
export default defineConfig({
  base: '/taskwave/',
  plugins: [vue(), tailwindcss()],
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
