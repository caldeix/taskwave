<div align="center">

# TaskWave

**Tus tareas personales en calendario y kanban, con cronómetro y registro de horas al estilo Jira.**

[![Abrir TaskWave](https://img.shields.io/badge/Abrir_TaskWave-caldeix.github.io%2Ftaskwave-2563EB?style=for-the-badge&logo=googlechrome&logoColor=white)](https://caldeix.github.io/taskwave)

[![Autor: caldeix](https://img.shields.io/badge/autor-caldeix-181717?logo=github&logoColor=white)](https://github.com/caldeix)
![© 2026 Caldeix](https://img.shields.io/badge/%C2%A9_2026-Caldeix-D4AF37)

![Version](https://img.shields.io/badge/Version-1.0.0-2563EB.svg)
![Vue](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vuedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Pinia](https://img.shields.io/badge/Pinia-4-FFD859?logo=vuedotjs&logoColor=black)
![Firebase](https://img.shields.io/badge/Firebase-Auth_%2B_Firestore-FFCA28?logo=firebase&logoColor=black)
![PWA](https://img.shields.io/badge/PWA-instalable-5A0FC8?logo=pwa&logoColor=white)
![Deployed on GitHub Pages](https://img.shields.io/badge/Deploy-GitHub_Pages-222?logo=github&logoColor=white)

</div>

---

## Descripción

**TaskWave** es un gestor de tareas personales. Organiza el trabajo por proyectos y lo muestra en un **calendario mensual** (una agenda en el móvil) o en un **kanban**. Cada tarea tiene su propia vista, con descripción en markdown, vínculos al estilo Jira, subtareas, tags, comentarios, registro de horas y el historial de cambios. Un **cronómetro** cuenta el tiempo de la tarea en la que trabajas y lo apunta solo; las estadísticas muestran a qué dedicas las horas y cuánto aciertas con tus estimaciones.

Sin servidor propio: la web es estática (GitHub Pages) y los datos se guardan en **Firebase** (Auth + Firestore), en el plan gratuito. Cada usuario solo puede leer y escribir lo suyo, y lo garantizan las **reglas de seguridad** de Firestore, no la app: el administrador aprueba o bloquea cuentas, pero no ve las tareas de nadie. Se instala como **PWA** y abre sin conexión con lo último que se vio.

---

## Características

- **Proyectos** — Con nombre, color e icono, y clave para numerar sus tareas como en Jira (`EST-12`). Las tareas sin proyecto van a la bandeja «Sin proyecto». Se ordenan, se archivan y se borran desde el menú lateral, plegable
- **Calendario mensual** — Las tareas son barras del color de su estado que ocupan sus días y cruzan semanas. Se arrastran a otro día, se crean pulsando un día y cada casilla muestra las horas registradas. Las tareas sin fecha esperan en un panel aparte, desde el que también se arrastran
- **Agenda en el móvil** — En pantallas estrechas, el mes se ve como una lista de días con sus tareas y horas
- **Kanban** — Una columna por estado (Pendiente, En curso, Paralizada, Realizada, Descartada y KO), ordenadas solas por fecha, con las atrasadas arriba en coral. Se cambia de estado arrastrando o desde el menú de la tarjeta, y las cerradas muestran solo las recientes con «Ver más antiguas»
- **Automatismos de estado** — Al cerrar una tarea se guarda cuándo y, si no tenía fecha fin, se le pone hoy; al reabrirla se borra el cierre. Iniciar el cronómetro la pasa a «En curso»
- **Vista de tarea** — Su propia URL, título editable, estado, prioridad, proyecto (al cambiarlo cambia la clave), fechas, estimado en formato `1d 2h 30m`, barra de horas con el exceso en coral, tags y enlaces web. Todo se guarda solo al cambiarlo
- **Descripción en markdown** — Editor con barra de formato, atajos y vista previa. Las listas de casillas se marcan sin entrar a editar. El HTML escrito se ve como texto y se sanea contra XSS
- **Vínculos y subtareas** — Bloquea / bloqueada por, causa / causada por y relacionada con, guardados en las dos tareas. Subtareas de un nivel que suman sus horas y estimados en la tarea padre
- **Tags** — Catálogo con color: renombrar un tag se ve al momento en todas sus tareas. Selector con autocompletado que crea el tag si no existe
- **Comentarios** — En markdown, del más reciente al más antiguo, con la marca «editado» y la fecha del servidor
- **Cronómetro** — Uno solo para toda la app, guardado en Firestore: sigue contando aunque se cierre la pestaña y se ve en todos los dispositivos. Mini cronómetro en el menú y en el título de la pestaña. Al pararlo crea un registro por día si pasa de medianoche, y a partir de 8 h avisa y pregunta a qué hora terminaste
- **Registro de horas** — Las horas de cada tarea por día, con su total. Se añaden a mano, se editan y se borran, y cada cambio ajusta las horas de la tarea
- **Tareas iniciadas** — Franja plegable con las tareas abiertas en las que has trabajado, de la última a la más antigua, con su % sobre el estimado
- **Actividad** — Historial de cada tarea: alta, estado, fechas, estimado, prioridad, proyecto y título, con el valor anterior y el nuevo
- **Filtros** — Estados visibles, periodo, orden, tags (cualquiera o todos), prioridad, atrasadas y sin fecha. Se guardan en la cuenta y valen para todos los dispositivos
- **Estadísticas** — Por semana, mes, últimos 30 días o año: horas por día, semana, proyecto y tag, mapa de calor y acierto de las estimaciones, con cada gráfico también en tabla
- **Búsqueda y atajos** — `Ctrl+K` busca tareas por clave o título y proyectos. Atajos: `N` nueva tarea, `C` calendario, `K` kanban y `/` buscar
- **Duplicar tareas** — Copia título, fechas, estimado, descripción, tags y enlaces; la copia nace Pendiente y sin horas
- **Cuentas con aprobación** — Correo y contraseña (con verificación de correo) o Google. Las cuentas nuevas esperan a que el administrador las apruebe, y él puede bloquearlas o reactivarlas desde su panel
- **Ajustes** — Nombre, horas de una jornada (lo que vale «1d»), aviso del cronómetro y tema, guardado en la cuenta
- **Baja de la cuenta** — Desde Ajustes, tras volver a identificarse: borra todas las tareas, horas, proyectos, tags y la cuenta
- **PWA** — Se instala como app, abre sin conexión y avisa cuando hay una versión nueva, sin cambiarse sola
- **Tema oscuro / claro** — Con la paleta del DS Personal y soporte automático del sistema
- **Diseño responsivo** — Pensado para escritorio, tablet y móvil

---

## Changelog

### v1.0.0 — Primera versión

- **Tareas y proyectos** — Proyectos con clave y bandeja, tareas con su clave, prioridad, fechas, estimado, enlaces y borrado en cascada, y vista de tarea con todo editable en el sitio
- **Calendario, agenda y kanban** — Calendario mensual con arrastrar y soltar, alta rápida y horas de cada día; agenda en el móvil; kanban por estados con automatismos al cerrar y reabrir
- **Detalle de la tarea** — Descripción en markdown, vínculos al estilo Jira, subtareas de un nivel, tags con color, comentarios y actividad
- **Tiempo** — Cronómetro único sincronizado entre dispositivos, con corte a medianoche y aviso de cronómetro olvidado; registro de horas manual; franja de tareas iniciadas; estadísticas con mapa de calor y acierto de las estimaciones
- **Uso diario** — Filtros guardados en la cuenta, búsqueda con `Ctrl+K`, atajos de teclado y duplicar tareas
- **Cuentas y seguridad** — Login con correo o Google, aprobación por el administrador, reglas de Firestore que validan cada documento, ajustes y baja de la cuenta
- **PWA** — Instalable, sin conexión y con aviso de versión nueva
- El detalle de todos los cambios está en el [CHANGELOG](CHANGELOG.md)
