import { reactive, ref } from 'vue'
import { reportService } from '../services/report.service'

const emptyMeta = () => ({ currentPage: 1, lastPage: 1, perPage: 15, total: 0 })

// Extrai itens + metadados de uma resposta de paginate() padrão do Laravel
// (formato "flat": { current_page, data, last_page, per_page, total, ... })
function extractPage(response) {
  return {
    items: response?.data ?? [],
    meta: {
      currentPage: response?.current_page ?? 1,
      lastPage: response?.last_page ?? 1,
      perPage: response?.per_page ?? 15,
      total: response?.total ?? 0,
    },
  }
}

export function useReports() {
  const isLoading = ref(false)
  const errorMessage = ref('')

  const data = ref({
    allVehicles: [],
    vehiclesByPerson: [],
    vehiclesByGender: [],
    brandsRanking: [],
    brandsByGender: [],
    allPeople: [],
    peopleByGender: [],
    revisionsByPeriod: [],
    brandsRevisionRanking: [],
    peopleRevisionRanking: [],
    avgIntervalByPerson: [],
    upcomingRevisions: [],
  })

  // Metadados de paginação de cada recurso paginado
  const pagination = reactive({
    vehiclesByPerson: emptyMeta(),
    allPeople: emptyMeta(),
    revisionsByPeriod: emptyMeta(),
    avgIntervalByPerson: emptyMeta(),
    upcomingRevisions: emptyMeta(),
  })

  // Loading isolado por tabela, pra trocar de página sem travar o dashboard inteiro
  const tableLoading = reactive({
    vehiclesByPerson: false,
    allPeople: false,
    revisionsByPeriod: false,
    avgIntervalByPerson: false,
    upcomingRevisions: false,
  })

  // ---------------------------------------------------------------------
  // FETCHERS INDIVIDUAIS (cada um busca 1 página de 1 recurso)
  // ---------------------------------------------------------------------
  async function fetchVehiclesByPerson(page = 1) {
    tableLoading.vehiclesByPerson = true
    try {
      const response = await reportService.vehiclesByPerson(page)
      const { items, meta } = extractPage(response)
      data.value.vehiclesByPerson = items
      pagination.vehiclesByPerson = meta
    } catch {
      errorMessage.value = 'Não foi possível carregar os veículos por pessoa.'
    } finally {
      tableLoading.vehiclesByPerson = false
    }
  }

  async function fetchAllPeople(page = 1) {
    tableLoading.allPeople = true
    try {
      const response = await reportService.allPeople(page)
      const { items, meta } = extractPage(response)
      data.value.allPeople = items
      pagination.allPeople = meta
    } catch {
      errorMessage.value = 'Não foi possível carregar as pessoas.'
    } finally {
      tableLoading.allPeople = false
    }
  }

  async function fetchRevisionsByPeriod(start = '', end = '', page = 1) {
    tableLoading.revisionsByPeriod = true
    try {
      const response = await reportService.revisionsByPeriod(start, end, page)
      const { items, meta } = extractPage(response)
      data.value.revisionsByPeriod = items
      pagination.revisionsByPeriod = meta
    } catch {
      errorMessage.value = 'Não foi possível carregar as revisões do período.'
    } finally {
      tableLoading.revisionsByPeriod = false
    }
  }

  async function fetchAvgIntervalByPerson(page = 1) {
    tableLoading.avgIntervalByPerson = true
    try {
      const response = await reportService.avgIntervalByPerson(page)
      const { items, meta } = extractPage(response)
      data.value.avgIntervalByPerson = items
      pagination.avgIntervalByPerson = meta
    } catch {
      errorMessage.value = 'Não foi possível carregar o intervalo médio entre revisões.'
    } finally {
      tableLoading.avgIntervalByPerson = false
    }
  }

  async function fetchUpcomingRevisions(page = 1) {
    tableLoading.upcomingRevisions = true
    try {
      const response = await reportService.upcomingRevisions(page)
      const { items, meta } = extractPage(response)
      data.value.upcomingRevisions = items
      pagination.upcomingRevisions = meta
    } catch {
      errorMessage.value = 'Não foi possível carregar as próximas revisões.'
    } finally {
      tableLoading.upcomingRevisions = false
    }
  }

  // ---------------------------------------------------------------------
  // FETCHERS EM GRUPO (carga inicial de cada seção)
  // ---------------------------------------------------------------------
  async function fetchVehicleReports() {
    isLoading.value = true
    errorMessage.value = ''
    try {
      const [all, byGender, brands, brandsGender] = await Promise.all([
        reportService.allVehicles(),
        reportService.vehiclesByGender(),
        reportService.brandsRanking(),
        reportService.brandsByGender(),
      ])
      data.value.allVehicles = all
      data.value.vehiclesByGender = byGender
      data.value.brandsRanking = brands
      data.value.brandsByGender = brandsGender
      await fetchVehiclesByPerson(1)
    } catch {
      errorMessage.value = 'Não foi possível carregar os relatórios de veículos.'
    } finally {
      isLoading.value = false
    }
  }

  async function fetchPeopleReports() {
    isLoading.value = true
    errorMessage.value = ''
    try {
      const byGender = await reportService.peopleByGender()
      data.value.peopleByGender = byGender
      await fetchAllPeople(1)
    } catch {
      errorMessage.value = 'Não foi possível carregar os relatórios de pessoas.'
    } finally {
      isLoading.value = false
    }
  }

  async function fetchRevisionReports(start = '', end = '') {
    isLoading.value = true
    errorMessage.value = ''
    try {
      const [brands, people] = await Promise.all([
        reportService.brandsRevisionRanking(),
        reportService.peopleRevisionRanking(),
      ])
      data.value.brandsRevisionRanking = brands
      data.value.peopleRevisionRanking = people
      await Promise.all([
        fetchRevisionsByPeriod(start, end, 1),
        fetchAvgIntervalByPerson(1),
        fetchUpcomingRevisions(1),
      ])
    } catch {
      errorMessage.value = 'Não foi possível carregar os relatórios de revisões.'
    } finally {
      isLoading.value = false
    }
  }

  return {
    data,
    pagination,
    tableLoading,
    isLoading,
    errorMessage,
    fetchVehicleReports,
    fetchPeopleReports,
    fetchRevisionReports,
    fetchVehiclesByPerson,
    fetchAllPeople,
    fetchRevisionsByPeriod,
    fetchAvgIntervalByPerson,
    fetchUpcomingRevisions,
  }
}