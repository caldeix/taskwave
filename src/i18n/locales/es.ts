/** Textos en español (P-3: i18n montado, de momento solo `es`). */
const es = {
  app: {
    name: 'TaskWave',
    tagline: 'Tus tareas, tu calendario y tus horas en un solo sitio.',
  },
  theme: {
    toggle: 'Cambiar entre modo claro y oscuro',
  },
  status: {
    pending: 'Pendiente',
    in_progress: 'En curso',
    paused: 'Paralizada',
    done: 'Realizada',
    discarded: 'Descartada',
    ko: 'KO',
  },
  showcase: {
    title: 'Sistema de diseño',
    intro: 'Página provisional del step-2 para comprobar los tokens del DS Personal en la app.',
    buttons: 'Botones',
    statuses: 'Estados',
    primary: 'Principal',
    secondary: 'Secundario',
    success: 'Correcto',
    danger: 'Peligro',
    ghost: 'Fantasma',
    disabled: 'Deshabilitado',
  },
  notFound: {
    title: 'Página no encontrada',
    back: 'Volver al inicio',
  },
}

export default es
export type MessageSchema = typeof es
