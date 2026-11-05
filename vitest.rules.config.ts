import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Tests contra el emulador de Firestore (127.0.0.1:8080): reglas (step-6) y consultas (step-9).
 * - `npm run test:rules` arranca el emulador, pasa los tests y lo para.
 * - `npm run test:rules:running` usa el que ya tengas en marcha con `npm run emulators`.
 * Usan su propio proyecto (`demo-taskwave-rules`), así que no tocan los datos de prueba del seed.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Todos los ficheros comparten el emulador: en serie para que no se pisen al limpiar datos.
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 30000,
  },
})
