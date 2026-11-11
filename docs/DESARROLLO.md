# Desarrollo de TaskWave

Guía para trabajar en el proyecto en local. La descripción de la app está en el [README](../README.md).

## Comandos

| Comando                      | Qué hace                                                        |
| ---------------------------- | --------------------------------------------------------------- |
| `npm run dev`                | Servidor de desarrollo en `http://localhost:5173/taskwave/`     |
| `npm run emulators`          | Arranca los emuladores de Auth y Firestore (`demo-taskwave`)    |
| `npm run seed`               | Vacía los emuladores y carga los datos de prueba                |
| `npm run dev:emu`            | Servidor de desarrollo conectado a los emuladores               |
| `npm run build`              | Comprueba los tipos y genera `dist/`                            |
| `npm run build:emu`          | Build contra los emuladores en `dist-emu/` (para probar la PWA) |
| `npm run preview:emu`        | Sirve `dist-emu/`                                               |
| `npm run test`               | Tests unitarios (Vitest)                                        |
| `npm run test:rules`         | Tests de reglas y consultas de Firestore (arranca su emulador)  |
| `npm run test:rules:running` | Lo mismo, usando los emuladores ya arrancados                   |
| `npm run lint`               | ESLint                                                          |
| `npm run format`             | Prettier                                                        |

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

## Publicación

Cada push a `main` lanza el workflow [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml): lint, formato, tests unitarios, tests de reglas con el emulador y build; si todo pasa, publica `dist/` en GitHub Pages (`https://caldeix.github.io/taskwave/`). También se puede lanzar a mano desde la pestaña Actions.

- **Secretos del repositorio** (Settings > Secrets and variables > Actions): los mismos nombres que `.env` (`VITE_FIREBASE_*` y `VITE_APPCHECK_SITE_KEY`). Se pueden subir desde el `.env` local con `gh secret set -f .env`.
- **GitHub Pages** con origen «GitHub Actions» (Settings > Pages).
- **Rutas profundas:** la build copia `index.html` como `404.html`, que Pages sirve para cualquier ruta que no existe; la app carga y el router muestra la ruta pedida.
- **CSP:** en producción la build añade un `<meta http-equiv="Content-Security-Policy">` con el hash de los scripts en línea (`src/lib/csp.ts`). No se añade con los emuladores.
- **Reglas e índices de Firestore:** se despliegan a mano (no se guarda ningún token de Firebase en GitHub): `npx firebase login` una vez y después `npx firebase deploy --only firestore`.
- **App Check:** proveedor reCAPTCHA Enterprise, que en Google Cloud se llama «Fraud Defense» (el reCAPTCHA clásico v3 está obsoleto en App Check; la API se habilita sin cuenta de pago y es gratis hasta 10 000 verificaciones al mes). La clave de sitio, pública, va en `VITE_APPCHECK_SITE_KEY` y en el secreto del mismo nombre, y la app está registrada en Firebase → App Check con esa clave. En desarrollo se usa un token de depuración registrado en la consola de Firebase. Primero se deja en monitorización y, cuando todas las peticiones llegan verificadas, se activa «Aplicar» en Firestore y Authentication.

## API de automatización

Con una cuenta activa dentro, la app instala `window.taskwave` (`src/automation/api.ts`, desde `AppLayout`), para que un asistente que maneje el navegador (Claude con la skill `use-taskwave`) use TaskWave sin leer la pantalla. Usa los mismos stores y validaciones que la interfaz, así que valen los automatismos (cierre, cronómetro, recurrentes, papelera) y las reglas de Firestore. Solo la pueden llamar scripts de la propia web (la CSP no deja cargar scripts de fuera) y desaparece al cerrar sesión.

- `await window.taskwave.help()` lista las funciones: lectura (`ready`, `projects`, `tags`, `templates`, `tasks`, `task`, `today`, `timerState`) y escritura (`createTask`, `updateTask`, `setStatus`, `move`, `logHours`, `comment`, `link`, `duplicate`, `remove`, `startTimer`, `stopTimer`).
- Acepta estados, prioridades, recurrencias y vínculos en español o en inglés, fechas como «hoy» o «mañana», duraciones como `1h 30m`, y proyectos y tags por nombre (`src/automation/normalize.ts`, con tests).
- Los errores son `Error` con el motivo en español.
