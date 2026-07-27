import { ref } from 'vue'
// 🟢 NOVO
import { useQueryClient } from '@tanstack/vue-query'
import { authService } from '../services/auth.service'
import { useAuthStore } from '../stores/auth.store'

export function useAuth() {
  const isLoading = ref(false)
  const errorMessage = ref('')
  const { setSession, clearSession } = useAuthStore()
  // 🟢 NOVO — dá acesso ao QueryClient global (o mesmo usado por
  // useQuery em Dashboard.vue, Relatorios.vue, UpcomingRevisionsCard.vue etc.)
  const queryClient = useQueryClient()

  async function login(payload) {
    isLoading.value = true
    errorMessage.value = ''
    try {
      const data = await authService.login(payload)
      // 🟢 NOVO — limpa qualquer dado em cache ANTES de abrir a nova sessão.
      // Sem isso, por uma fração de segundo (ou até o refetch em segundo
      // plano terminar) as telas mostram dados do usuário anterior.
      queryClient.clear()
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
      // 🟢 NOVO — mesmo motivo do login
      queryClient.clear()
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
    // 🟢 NOVO — apaga TODO o cache (people, vehicles, dashboard-summary,
    // upcoming-revisions, relatórios etc.) pra garantir que nada da conta
    // que está saindo sobreviva pra próxima sessão.
    queryClient.clear()
    clearSession()
  }

  return { isLoading, errorMessage, login, register, logout }
}