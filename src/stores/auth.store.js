import { ref, computed } from 'vue'

const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))
const token = ref(localStorage.getItem('access_token'))

export function useAuthStore() {
  const isAuthenticated = computed(() => !!token.value)

  function setSession({ access_token, user: userData }) {
    token.value = access_token
    user.value = userData
    localStorage.setItem('access_token', access_token)
    localStorage.setItem('user', JSON.stringify(userData))
  }

  function clearSession() {
    token.value = null
    user.value = null
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
  }

  return { user, token, isAuthenticated, setSession, clearSession }
}