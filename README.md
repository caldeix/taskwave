# TaskWave

Gestor de tareas personales con calendario mensual, kanban, cronómetro y registro de horas al estilo Jira.
Se publica en `https://caldeix.github.io/taskwave/` y usa Firebase (Auth y Firestore) en el plan gratuito.

## Pila

Vue 3 · TypeScript · Vite · Tailwind CSS 4 (con los tokens del DS Personal) · Pinia · Vue Router · vue-i18n · Firebase.

## Comandos

| Comando                      | Qué hace                                                       |
| ---------------------------- | -------------------------------------------------------------- |
| `npm run dev`                | Servidor de desarrollo en `http://localhost:5173/taskwave/`    |
| `npm run emulators`          | Arranca los emuladores de Auth y Firestore (`demo-taskwave`)   |
| `npm run seed`               | Vacía los emuladores y carga los datos de prueba               |
| `npm run dev:emu`            | Servidor de desarrollo conectado a los emuladores              |
| `npm run build`              | Comprueba los tipos y genera `dist/`                           |
| `npm run test`               | Tests unitarios (Vitest)                                       |
| `npm run test:rules`         | Tests de reglas y consultas de Firestore (arranca su emulador) |
| `npm run test:rules:running` | Lo mismo, usando los emuladores ya arrancados                  |
| `npm run lint`               | ESLint                                                         |
| `npm run format`             | Prettier                                                       |

## Configuración local

Los ficheros de configuración no se versionan; se crean a partir de las plantillas:

1. `cp .env.example .env` y rellenar los valores con la configuración web del proyecto de Firebase.
2. `cp .env.emulator.example .env.emulator` para el modo emulador (no hace falta cambiar nada).
3. `cp .firebaserc.example .firebaserc` y poner el ID del proyecto de Firebase (solo para desplegar
   reglas e índices con `firebase deploy`).

La seguridad de los datos la dan las reglas de Firestore (`firestore.rules`) y App Check.

## Desarrollo con emuladores

Requiere Java 21 o superior (Temurin 21 instalado con `winget install EclipseAdoptium.Temurin.21.JDK`).

1. `npm run emulators`: Auth en `127.0.0.1:9099`, Firestore en `127.0.0.1:8080` y la interfaz en `http://127.0.0.1:4000/`.
2. En otra terminal, `npm run seed`: crea 4 usuarios de prueba (`admin`, `activo`, `pendiente` y `bloqueado`, todos `@taskwave.test`) con proyectos, tags, tareas, registros de horas, comentarios y actividad. La contraseña es la constante `TEST_PASSWORD` de `scripts/seed.mjs`.
3. `npm run dev:emu`: la app usa `.env.emulator` (copiado de `.env.emulator.example`), con el proyecto `demo-taskwave`, que no existe en Google. Nada sale del equipo ni gasta cuota.

Los emuladores no guardan datos al cerrarse: se vuelve a ejecutar `npm run seed` cada vez.
