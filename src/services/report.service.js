import { api } from '../lib/api'

export const reportService = {
  // Veículos
  allVehicles: () => api.get('/reports/vehicles').then((r) => r.data),
  vehiclesByPerson: (page = 1) =>
    api.get('/reports/vehicles/by-person', { params: { page } }).then((r) => r.data), // paginado
  vehiclesByGender: () => api.get('/reports/vehicles/by-gender').then((r) => r.data),
  brandsRanking: () => api.get('/reports/vehicles/brands-ranking').then((r) => r.data),
  brandsByGender: () => api.get('/reports/vehicles/brands-by-gender').then((r) => r.data),

  // Pessoas
  allPeople: (page = 1) =>
    api.get('/reports/people', { params: { page } }).then((r) => r.data), // paginado
  peopleByGender: () => api.get('/reports/people/by-gender').then((r) => r.data),

  // Revisões
  revisionsByPeriod: (start, end, page = 1) =>
    api.get('/reports/revisions', { params: { start, end, page } }).then((r) => r.data), // paginado
  brandsRevisionRanking: () => api.get('/reports/revisions/brands-ranking').then((r) => r.data),
  peopleRevisionRanking: () => api.get('/reports/revisions/people-ranking').then((r) => r.data),
  avgIntervalByPerson: (page = 1) =>
    api.get('/reports/revisions/avg-interval', { params: { page } }).then((r) => r.data), // paginado
  upcomingRevisions: (page = 1) =>
    api.get('/reports/revisions/upcoming', { params: { page } }).then((r) => r.data), // paginado
}