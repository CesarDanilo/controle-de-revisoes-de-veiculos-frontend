import { ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { authService } from '../services/auth.service'
import { useAuthStore } from '../stores/auth.store'

export function useAuth() {
  const isLoading = ref(false)
  const errorMessage = ref('')
  const { setSession, clearSession } = useAuthStore()
  const queryClient = useQueryClient()

  async function login(payload) {
    isLoading.value = true
    errorMessage.value = ''
    try {
      const data = await authService.login(payload)
      
      // ✅ Primeiro define a nova sessão com o token
      setSession(data)
      
      // ✅ Depois limpa o cache antigo
      queryClient.clear()
      
      return data
    } catch (err) {
      errorMessage.value =
        err.response?.data?.message ?? 'E-mail ou senha inválidos.'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function register(payload) {
    isLoading.value = true
    errorMessage.value = ''
    try {
      // Agora o register efetuará o login e retornará { token, user }
      const data = await authService.register(payload)
      
      // ✅ Primeiro define a sessão com o token obtido no login
      setSession(data)
      
      // ✅ Depois limpa o cache
      queryClient.clear()
      
      return data
    } catch (err) {
      errorMessage.value =
        err.response?.data?.message ?? 'Não foi possível criar sua conta.'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  function logout() {
    queryClient.clear()
    clearSession()
  }

  return { isLoading, errorMessage, login, register, logout }
}