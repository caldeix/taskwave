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
  auth: {
    email: 'Correo electrónico',
    password: 'Contraseña',
    name: 'Nombre',
    confirmPassword: 'Repite la contraseña',
    passwordHelp: 'Mínimo {min} caracteres.',
    or: 'o',
    google: 'Continuar con Google',
    logout: 'Cerrar sesión',
    loggedInAs: 'Sesión iniciada como {email}',
    login: {
      title: 'Iniciar sesión',
      subtitle: 'Entra con tu correo o con tu cuenta de Google.',
      submit: 'Entrar',
      forgot: '¿Has olvidado la contraseña?',
      noAccount: '¿No tienes cuenta?',
      register: 'Crear una cuenta',
    },
    register: {
      title: 'Crear una cuenta',
      subtitle: 'Cuando verifiques tu correo, el administrador revisará tu alta.',
      submit: 'Crear cuenta',
      haveAccount: '¿Ya tienes cuenta?',
      login: 'Iniciar sesión',
    },
    reset: {
      title: 'Recuperar la contraseña',
      subtitle: 'Te enviaremos un enlace para elegir una contraseña nueva.',
      submit: 'Enviar enlace',
      sent: 'Si existe una cuenta con ese correo, te hemos enviado un enlace. Revisa también la carpeta de spam.',
      back: 'Volver a iniciar sesión',
    },
    verify: {
      title: 'Verifica tu correo',
      subtitle:
        'Te hemos enviado un enlace a {email}. Ábrelo y después pulsa «Ya lo he verificado».',
      check: 'Ya lo he verificado',
      resend: 'Reenviar el correo',
      resent: 'Te hemos enviado otro correo de verificación.',
      notYet:
        'Tu correo aún no aparece como verificado. Abre el enlace del correo y vuelve a intentarlo.',
      wrongAccount: '¿No es tu cuenta?',
    },
    validation: {
      nameRequired: 'Escribe tu nombre.',
      emailInvalid: 'Escribe un correo válido.',
      passwordShort: 'La contraseña debe tener al menos 8 caracteres.',
      passwordMismatch: 'Las contraseñas no coinciden.',
    },
    errors: {
      invalidCredential: 'El correo o la contraseña no son correctos.',
      invalidEmail: 'El correo no es válido.',
      emailInUse: 'Ya existe una cuenta con ese correo. Inicia sesión o recupera la contraseña.',
      weakPassword: 'La contraseña es demasiado débil.',
      tooManyRequests: 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
      network: 'No hay conexión. Comprueba tu red y vuelve a intentarlo.',
      userDisabled: 'Esta cuenta está desactivada.',
      popupClosed: 'Se ha cerrado la ventana de Google.',
      popupBlocked:
        'El navegador ha bloqueado la ventana de Google. Permite las ventanas emergentes.',
      differentCredential:
        'Ya existe una cuenta con ese correo y otro método de acceso. Entra con el método que usaste.',
      recentLogin: 'Por seguridad, vuelve a iniciar sesión e inténtalo de nuevo.',
      generic: 'Algo ha fallado. Vuelve a intentarlo.',
    },
  },
}

export default es
export type MessageSchema = typeof es
