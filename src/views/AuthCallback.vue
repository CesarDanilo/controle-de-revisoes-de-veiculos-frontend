<script setup>
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/auth.store'

const route = useRoute()
const router = useRouter()
const { setSession } = useAuthStore()

onMounted(async () => {
  const token = route.query.token

  if (!token) {
    router.replace('/login')
    return
  }

  try {
    const { data: user } = await api.get('/me', {
    headers: { Authorization: `Bearer ${token}` },
    })

    setSession({ access_token: token, user })
    router.replace('/painel')
    } catch (error) {
    console.error('Falha ao autenticar:', error)
    router.replace('/login')
    }
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center">
    <p class="text-sm text-ink-500">Autenticando...</p>
  </div>
</template>