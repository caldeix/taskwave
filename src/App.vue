<script setup lang="ts">
import { watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { guardTarget } from '@/router'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const profileStore = useProfileStore()

// Redirección en vivo: si cambia la sesión o el estado (el admin aprueba o bloquea la cuenta),
// se vuelve a aplicar la guarda a la ruta actual sin que el usuario tenga que recargar.
watch(
  () => [authStore.isLoggedIn, authStore.mustVerifyEmail, profileStore.status] as const,
  async () => {
    if (!authStore.ready) return
    await profileStore.whenLoaded()
    const target = guardTarget(route)
    if (target) await router.replace(target)
  },
)
</script>

<template>
  <RouterView />
</template>
