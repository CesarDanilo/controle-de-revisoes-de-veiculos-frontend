import { api } from '../lib/api'

export const reportService = {
  // Veículos
  allVehicles: () => api.get('/reports/vehicles').then((r) => r.data),
  vehiclesByPerson: () => api.get('/reports/vehicles/by-person').then((r) => r.data),
  vehiclesByGender: () => api.get('/reports/vehicles/by-gender').then((r) => r.data),
  brandsRanking: () => api.get('/reports/vehicles/brands-ranking').then((r) => r.data),
  brandsByGender: () => api.get('/reports/vehicles/brands-by-gender').then((r) => r.data),

  // Pessoas
  allPeople: () => api.get('/reports/people').then((r) => r.data),
  peopleByGender: () => api.get('/reports/people/by-gender').then((r) => r.data),

  // Revisões
  revisionsByPeriod: (start, end) =>
    api.get('/reports/revisions', { params: { start, end } }).then((r) => r.data),
  brandsRevisionRanking: () => api.get('/reports/revisions/brands-ranking').then((r) => r.data),
  peopleRevisionRanking: () => api.get('/reports/revisions/people-ranking').then((r) => r.data),
  avgIntervalByPerson: () => api.get('/reports/revisions/avg-interval').then((r) => r.data),
  upcomingRevisions: () => api.get('/reports/revisions/upcoming').then((r) => r.data),
}