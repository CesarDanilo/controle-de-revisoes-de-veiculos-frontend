// TODO: ajuste o import abaixo pro client HTTP real do seu projeto
// (o mesmo que vehicle.service.js / revision.service.js usam)
import { api } from "../lib/api"

export const dashboardService = {
  getSummary: () => api.get('/dashboard/summary').then((res) => res.data),
}