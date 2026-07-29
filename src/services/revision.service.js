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

  // 🟢 NOVO — usado pelo Kanban: busca TODAS as revisões do usuário
  // (sem filtrar por veículo), pra distribuir nas colunas por status.
  // Mesmo motivo do per_page alto do listByVehicle: o endpoint pagina por
  // padrão (15), e o board precisa ver tudo de uma vez por enquanto.
  async list() {
    const { data } = await api.get('/revisions', {
      params: { per_page: 500 },
    })

    return Array.isArray(data) ? data : data?.data ?? []
  },

  // 🟢 NOVO — chamado pelo drag-and-drop do Kanban a cada vez que um card
  // muda de coluna. Endpoint dedicado: PATCH /revisions/{id}/status.
  async updateStatus(id, status) {
    const { data } = await api.patch(`/revisions/${id}/status`, { status })
    return data
  },
  
  async updateStatusFields(id, payload) {
    const { data } = await api.patch(`/revisions/${id}/status`, payload)
    return data
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