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
