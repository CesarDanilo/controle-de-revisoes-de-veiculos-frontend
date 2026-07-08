import { ref } from 'vue'
import { authService } from '../services/auth.service'
import { useAuthStore } from '../stores/auth.store'

export function useAuth() {
  const isLoading = ref(false)
  const errorMessage = ref('')
  const { setSession, clearSession } = useAuthStore()

  async function login(payload) {
    isLoading.value = true
    errorMessage.value = ''
    try {
      const data = await authService.login(payload)
      setSession(data)
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
      const data = await authService.register(payload)
      setSession(data)
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
    clearSession()
  }

  return { isLoading, errorMessage, login, register, logout }
}