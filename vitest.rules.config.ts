import { defineConfig } from 'vitest/config'

/**
 * Tests de las reglas de Firestore (step-6). Necesitan el emulador de Firestore en 127.0.0.1:8080:
 * - `npm run test:rules` lo arranca, pasa los tests y lo para.
 * - `npm run test:rules:running` usa el que ya tengas en marcha con `npm run emulators`.
 * Usan su propio proyecto (`demo-taskwave-rules`), así que no tocan los datos de prueba del seed.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    // Todos los ficheros comparten el emulador: en serie para que no se pisen al limpiar datos.
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 30000,
  },
})
