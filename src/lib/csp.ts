/**
 * Content Security Policy de producción (step-27, R-3). GitHub Pages no deja enviar cabeceras
 * HTTP (D-4), así que va en un `<meta http-equiv>` que añade `vite.config.ts` al construir.
 * Por eso no hay `frame-ancestors` (no funciona en `<meta>`): lo sustituye el frame-busting
 * de `main.ts`.
 *
 * - Scripts: solo los de la app y los scripts en línea por su hash (el del tema en `index.html`),
 *   más los de Google necesarios para el login con Google y para App Check (reCAPTCHA).
 * - Conexiones: solo a las APIs de Firebase y Google.
 * - Imágenes: las de la app y cualquier `https` (la descripción en markdown admite imágenes).
 * - Estilos: los de la app y en línea (Vue y reCAPTCHA ponen estilos en los elementos).
 */

export interface CspOptions {
  /** Dominio de Firebase Auth (`<proyecto>.firebaseapp.com`): su iframe hace el login. */
  authDomain: string
  /** Hashes `sha256-…` de los scripts en línea permitidos. */
  scriptHashes: string[]
}

export function buildCsp({ authDomain, scriptHashes }: CspOptions): string {
  const auth = authDomain ? `https://${authDomain}` : ''
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      ...scriptHashes.map((h) => `'${h}'`),
      'https://apis.google.com',
      'https://www.google.com/recaptcha/',
      'https://www.gstatic.com/recaptcha/',
    ],
    'connect-src': ["'self'", 'https://*.googleapis.com', 'https://www.google.com/recaptcha/'],
    'frame-src': [
      auth,
      'https://accounts.google.com',
      'https://www.google.com/recaptcha/',
      'https://recaptcha.google.com/recaptcha/',
    ],
    'img-src': ["'self'", 'data:', 'https:'],
    'style-src': ["'self'", "'unsafe-inline'"],
    'font-src': ["'self'", 'data:'],
    'worker-src': ["'self'"],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  }
  return Object.entries(directives)
    .map(([name, values]) => [name, ...values.filter(Boolean)].join(' '))
    .join('; ')
}

/** Contenido de los `<script>` en línea (sin `src`) de un HTML, para calcular sus hashes. */
export function inlineScripts(html: string): string[] {
  const scripts: string[] = []
  const re = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) if (match[1]!.trim()) scripts.push(match[1]!)
  return scripts
}
