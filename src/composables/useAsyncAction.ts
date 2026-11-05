import { ref } from 'vue'
import { authErrorKey, isSilentAuthError } from '@/domain/auth'

/**
 * Ejecuta una acción asíncrona de auth controlando el estado «ocupado» y el error a mostrar
 * (como clave i18n). Devuelve `true` si ha ido bien.
 */
export function useAsyncAction() {
  const busy = ref(false)
  const errorKey = ref<string | null>(null)

  async function run(action: () => Promise<void>): Promise<boolean> {
    busy.value = true
    errorKey.value = null
    try {
      await action()
      return true
    } catch (error) {
      if (!isSilentAuthError(error)) errorKey.value = authErrorKey(error)
      return false
    } finally {
      busy.value = false
    }
  }

  return { busy, errorKey, run }
}
