import { api } from '../lib/api'

export const authService = {
  async login({ email, password }) {
    const { data } = await api.post('/login', { email, password })
    return data
  },

  async register({ name, email, password }) {
    const { data } = await api.post('/users', { name, email, password })
    return data
  },
}