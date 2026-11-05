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
- Perfil `users/{uid}`: se crea al primer acceso con el correo verificado, siempre pendiente y sin admin, y se escucha en vivo.
- Pantallas de cuenta pendiente de aprobación, bloqueada y error al cargar la cuenta (con reintento). Al aprobar o bloquear una cuenta, la app redirige sin recargar.
- Capa de datos de tareas: modelo `Task`, fechas de día `AAAA-MM-DD` con `date-fns` y consultas siempre acotadas (por rango de fechas con solapamiento, sin fecha, abiertas, cerradas desde una fecha e iniciadas con límite), filtradas por todos, bandeja o proyecto. Composable `useLiveTasks` para escucharlas en vivo sin duplicados.
- Caché persistente de Firestore (IndexedDB, varias pestañas) que se borra al cerrar sesión.
- Índices compuestos de las consultas de tareas en `firestore.indexes.json`.
- Tests de las consultas contra el emulador (incluidos en `npm run test:rules`).
- Estructura de la app: menú lateral plegable (se recuerda en `prefs.sidebarCollapsed`) con «Todos», «Sin proyecto», proyectos, archivados, panel de admin con el contador, tema y cierre de sesión; en móvil, el menú es un cajón.
- Proyectos: crear (con la clave propuesta a partir del nombre), editar nombre, color e icono (la clave no cambia), subir y bajar, archivar y desarchivar, y eliminar solo si no tiene tareas.
- Vista principal por «Todos», «Sin proyecto» o proyecto, con el selector Calendario/Kanban en la URL (`?vista=`) y recordado en `prefs.view`. El calendario y el kanban son de momento un marcador.
- Componentes `BaseDialog`, `DropdownMenu` (con teclado) y avisos (`ToastHost`).
- Panel de admin de usuarios (`/admin/usuarios`, solo para el admin activo): filtros por estado con contadores, búsqueda por nombre o correo sin distinguir tildes, y acciones de aprobar, bloquear (con confirmación) y reactivar. El admin no actúa sobre su propia cuenta.
- Contador de altas pendientes en vivo junto al acceso al panel (D-9).
- Componentes `ConfirmDialog` (con `<dialog>` nativo) y `UserStatusBadge`, y formato de fechas en español con la hora de Madrid.
- Reglas de Firestore para los datos de cada usuario (proyectos, tareas, comentarios, actividad, registro de horas y tags): solo el dueño con la cuenta activa y el correo verificado; el admin no tiene acceso. Cada documento se valida entero: campos permitidos, tipos, enumerados, tamaños máximos, fechas `AAAA-MM-DD`, marcas de tiempo del servidor y fecha fin no anterior al inicio.
- 54 tests de reglas con `@firebase/rules-unit-testing` (`npm run test:rules`), en su propio proyecto `demo-taskwave-rules`.
- Reglas de Firestore del perfil: cada usuario lee el suyo; solo el admin lista los perfiles y cambia el estado de otros; nadie puede darse admin ni cambiarse el estado; un usuario bloqueado no puede borrar su perfil.
