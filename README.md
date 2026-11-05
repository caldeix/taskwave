# TaskWave

Gestor de tareas personales con calendario mensual, kanban, cronómetro y registro de horas al estilo Jira.
Se publica en `https://caldeix.github.io/taskwave/` y usa Firebase (Auth y Firestore) en el plan gratuito.

## Pila

Vue 3 · TypeScript · Vite · Tailwind CSS 4 (con los tokens del DS Personal) · Pinia · Vue Router · vue-i18n · Firebase.

## Comandos

| Comando          | Qué hace                                                    |
| ---------------- | ----------------------------------------------------------- |
| `npm run dev`    | Servidor de desarrollo en `http://localhost:5173/taskwave/` |
| `npm run build`  | Comprueba los tipos y genera `dist/`                        |
| `npm run test`   | Tests unitarios (Vitest)                                    |
| `npm run lint`   | ESLint                                                      |
| `npm run format` | Prettier                                                    |

## Firebase

- Proyecto `timeclock-9270c` (nombre visible: TaskWave), Firestore en `europe-southwest1`.
- La configuración de `.env` es pública por diseño: la seguridad la dan las reglas de Firestore y App Check.
