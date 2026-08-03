import { api } from '../lib/api'

export const authService = {
  async login({ email, password }) {
    const { data } = await api.post('/login', { email, password })
    return data
  },

  async register({ name, email, password }) {
    // 1. Cria o usuário no backend (POST /users)
    await api.post('/users', { name, email, password })

    // 2. Faz o login automático logo em seguida para obter o token e dados da sessão
    return await this.login({ email, password })
  },
}