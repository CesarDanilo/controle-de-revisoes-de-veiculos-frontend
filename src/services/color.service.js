import { api } from '../lib/api'

export const colorService = {
  async list() {
    const { data } = await api.get('/colors')
    return data
  },

  async create(payload) {
    const { data } = await api.post('/colors', payload)
    return data
  },
}