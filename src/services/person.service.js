import { api } from '../lib/api'

export const personService = {
  async list() {
    const { data } = await api.get('/people')
    return data
  },

  async create(payload) {
    const { data } = await api.post('/people', payload)
    return data
  },

  async update(id, payload) {
    const { data } = await api.put(`/people/${id}`, payload)
    return data
  },

  async remove(id) {
    await api.delete(`/people/${id}`)
  },
}