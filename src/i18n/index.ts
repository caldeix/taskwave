import { createI18n } from 'vue-i18n'
import es, { type MessageSchema } from './locales/es'

export const i18n = createI18n<[MessageSchema], 'es'>({
  legacy: false,
  locale: 'es',
  fallbackLocale: 'es',
  messages: { es },
})
