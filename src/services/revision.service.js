import { api } from '../lib/api'

export const revisionService = {
  async listByVehicle(vehicleId) {
    const { data } = await api.get('/revisions', {
      params: { vehicle_id: vehicleId, per_page: 50 },
    })

    // The backend returns a plain array here (not a paginated resource
    // wrapped in { data, links, meta }), so `data` already IS the list.
    // Kept the fallback just in case the endpoint changes shape later.
    return Array.isArray(data) ? data : data?.data ?? []
  },

  async create(payload) {
    const { data } = await api.post('/revisions', payload)
    return data
  },

  async update(id, payload) {
    const { data } = await api.put(`/revisions/${id}`, payload)
    return data
  },

  async delete(id) {
    const { data } = await api.delete(`/revisions/${id}`)
    return data
  },
}