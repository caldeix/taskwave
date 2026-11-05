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
- Vista de tarea (`/t/EST-12`), que se abre al pulsar una tarea en el calendario, el kanban o «Sin fecha»: «Volver», título editable en el sitio, borrar con confirmación y un panel derecho plegable con estado (badge con lista), prioridad, proyecto (al cambiarlo cambia la clave y la URL), fechas, estimado en formato `1d 2h 30m`, barra de horas (amarillo estimado, verde gastado y exceso en coral), enlaces web (solo http y https) y fechas de alta, actualización y cierre. Cada campo se guarda solo al cambiarlo.
- Descripción de la tarea en markdown: se lee formateada y se edita con pestañas «Escribir» y «Vista previa», barra de formato (negrita, cursiva, título, lista, lista de casillas, cita, código y enlace), atajos Ctrl+B, Ctrl+I y Ctrl+K, Ctrl+Enter para guardar y Esc para cancelar (pide confirmación si hay cambios). Las casillas `- [ ]` se marcan sin entrar a editar y se guardan al momento.
- El markdown se sanea contra XSS: el HTML escrito se ve como texto, solo se permiten enlaces e imágenes `http`, `https` y `mailto`, y los enlaces se abren en otra pestaña con `rel="noopener noreferrer nofollow"`.
- Vínculos entre tareas como en Jira (bloquea / bloqueada por, causa / causada por, relacionada con): se guardan en las dos tareas, se ven agrupados por tipo con su estado y llevan a la tarea vinculada. Se añaden con un buscador por clave o título (con el teclado: flechas y Enter) y se quitan desde cualquiera de las dos.
- Subtareas de un solo nivel: alta rápida desde la tarea padre, convertir una tarea existente en subtarea (o elegir su padre), sacarla de las subtareas, y la padre muestra cuántas están cerradas y sus horas con el total con subtareas en el panel (horas y estimado sumados).
- Duraciones al estilo Jira (`1d 2h 30m`, con 1d = jornada configurada).
- Barra de filtros: ojo de estados visibles (oculta columnas del kanban y barras del calendario), periodo (hoy, esta semana, este mes, este año; entran las tareas que tocan el periodo), orden (por fecha fin o inicio, por inicio o por fin, en los dos sentidos), tags (cualquiera o todos), prioridad, «Atrasadas» y «Sin fecha», con «Quitar filtros». En el calendario el periodo es el mes visible, así que el periodo, el orden y «Sin fecha» solo salen en el kanban.
- Los filtros se guardan en las preferencias del usuario (los mismos en todos los proyectos y dispositivos), juntando los cambios seguidos en una sola escritura.
- Las tareas con fin igual al inicio muestran una sola fecha.
- Kanban con una columna por estado y orden automático: por fecha fin o, si no tiene, de inicio, de la más próxima a la más lejana, con las atrasadas arriba en coral y las que no tienen fecha al final. En «Todos», cada tarjeta muestra su proyecto.
- Cambiar de estado arrastrando una tarjeta a otra columna o desde su menú («Mover a…»). Al cerrar se guarda cuándo y, si no tenía fecha fin, se le pone hoy; al reabrir se borra la fecha de cierre.
- Las columnas cerradas muestran las cerradas en los últimos 30 días, con «Ver más antiguas» (90, 365 días o todas).
- Eliminar una tarea desde el menú de su tarjeta (sustituye a la lista provisional).
- Calendario mensual (semanas de lunes a domingo, mes en la URL con `?mes=`, botones de mes anterior y siguiente y «Hoy»): las tareas son barras del color de su estado que ocupan sus días y cruzan semanas; se reparten en carriles y, si no caben, «+N más» abre la lista del día.
- Arrastrar una tarea a otro día mueve inicio y fin manteniendo la duración y respetando el día por el que se cogió; el día de destino se resalta.
- Alta rápida pulsando un día: título + Enter la crea en ese día y en el proyecto actual; «Más opciones» abre el formulario completo con el día y el título.
- Panel «Sin fecha» junto al calendario, desde el que se arrastran tareas a un día.
- Alta de tareas: título, proyecto o bandeja, fechas opcionales y prioridad. Nacen Pendientes con su clave (`EST-12`, o `INB-3` sin proyecto), sacada del contador en una transacción para que dos altas a la vez no repitan clave.
- Borrado definitivo de tareas, con confirmación y en cascada: comentarios, actividad y registro de horas; sus vínculos desaparecen de las otras tareas, sus subtareas quedan sueltas y, si el cronómetro estaba en ella, se para.
- Componentes `BaseSelect`, campo de fecha en `BaseInput` y `PriorityIcon` (alta coral, media mostaza, baja azul).
- Lista provisional de tareas del mes y sin fecha en la vista principal, hasta el calendario.
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
