// Ajuste este import para o client axios que o projeto já usa
// (o mesmo importado em dashboard.service.js / report.service.js).
import { api } from "../lib/api"
 
export const reportExportService = {
  request(type, { start, end } = {}) {
    return api.post('/reports/exports', { type, start, end }).then((res) => res.data)
  },

  status(id) {
    return api.get(`/reports/exports/${id}`).then((res) => res.data)
  },

  async downloadBlob(id) {
    const response = await api.get(`/reports/exports/${id}/download`, {
      responseType: 'blob',
    })
    return response.data
  },
}