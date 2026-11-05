# Changelog

Todos los cambios relevantes de TaskWave. Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado [SemVer](https://semver.org/lang/es/).

## [Sin publicar]

### Añadido

- Proyecto base: Vite 8, Vue 3.5, TypeScript 6, Tailwind CSS 4, Pinia, Vue Router (historial bajo `/taskwave/`), vue-i18n (solo `es`), ESLint, Prettier y Vitest.
- Tokens del DS Personal en Tailwind: fuentes Cormorant y Roboto, y paleta con los valores RGB exactos del DS más `violet` para el estado Pendiente.
- Modo claro y oscuro con la misma convención que el DS (clase `light`/`dark` en `<html>` y clave `theme` en localStorage).
- Componentes base: `BaseButton` (principal, secundario, correcto, peligro y fantasma), `IconButton`, `ThemeToggle` y `StatusBadge`.
- Estados de tarea con sus colores (`src/domain/status.ts`).
- Configuración pública de Firebase en `.env` y proyecto por defecto en `.firebaserc`.
- Emulator Suite (Auth y Firestore) con el proyecto `demo-taskwave`, reglas provisionales que lo deniegan todo y scripts `emulators`, `seed` y `dev:emu`.
- Inicialización de Firebase en la app (`src/lib/firebase.ts`), que se conecta a los emuladores en modo `emulator`.
- Datos de prueba (`scripts/seed.mjs`): 4 usuarios (admin, activo, pendiente y bloqueado), 3 proyectos con la bandeja, 5 tags, 62 tareas en tres meses con todos los estados, vínculos, subtareas, una tarea de varios días, 69 registros de horas (uno de ellos cruza la medianoche), comentarios y actividad.
- Acceso: login con correo o con Google (ventana emergente), registro con verificación de correo obligatoria, recuperación de contraseña y cierre de sesión. Los correos de Firebase salen en español.
- Guardas de ruta por sesión: sin sesión se va al login (con vuelta a la ruta pedida, solo si es interna); con el correo sin verificar, solo se ve la pantalla de verificación.
- La recuperación de contraseña muestra el mismo mensaje exista o no la cuenta.
- Componentes de formulario del DS: `BaseInput`, `FormMessage` y `TextLink`.
