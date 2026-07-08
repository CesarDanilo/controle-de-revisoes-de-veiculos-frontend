import { api } from '../lib/api'

export const brandService = {
  async list() {
    const { data } = await api.get('/brands')
    return data
  },

  async create(payload) {
    const { data } = await api.post('/brands', payload)
    return data
  },
}