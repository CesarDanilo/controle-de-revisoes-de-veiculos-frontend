import { api } from '../lib/api'

export const vehicleService = {
  async list() {
    const { data } = await api.get('/vehicles')
    return data
  },

  async create(payload) {
    const { data } = await api.post('/vehicles', payload)
    return data
  },

  async update(id, payload) {
    const { data } = await api.put(`/vehicles/${id}`, payload)
    return data
  },

  async remove(id) {
    await api.delete(`/vehicles/${id}`)
  },
}