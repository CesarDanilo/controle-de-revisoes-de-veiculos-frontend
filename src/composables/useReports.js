import { ref } from 'vue'
import { reportService } from '../services/report.service'

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

  async function fetchVehicleReports() {
    isLoading.value = true
    errorMessage.value = ''
    try {
      const [all, byPerson, byGender, brands, brandsGender] = await Promise.all([
        reportService.allVehicles(),
        reportService.vehiclesByPerson(),
        reportService.vehiclesByGender(),
        reportService.brandsRanking(),
        reportService.brandsByGender(),
      ])
      data.value.allVehicles = all
      data.value.vehiclesByPerson = byPerson
      data.value.vehiclesByGender = byGender
      data.value.brandsRanking = brands
      data.value.brandsByGender = brandsGender
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
      const [all, byGender] = await Promise.all([
        reportService.allPeople(),
        reportService.peopleByGender(),
      ])
      data.value.allPeople = all
      data.value.peopleByGender = byGender
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
      const [byPeriod, brands, people, avgInterval, upcoming] = await Promise.all([
        reportService.revisionsByPeriod(start, end),
        reportService.brandsRevisionRanking(),
        reportService.peopleRevisionRanking(),
        reportService.avgIntervalByPerson(),
        reportService.upcomingRevisions(),
      ])
      data.value.revisionsByPeriod = byPeriod
      data.value.brandsRevisionRanking = brands
      data.value.peopleRevisionRanking = people
      data.value.avgIntervalByPerson = avgInterval
      data.value.upcomingRevisions = upcoming
    } catch {
      errorMessage.value = 'Não foi possível carregar os relatórios de revisões.'
    } finally {
      isLoading.value = false
    }
  }

  return { data, isLoading, errorMessage, fetchVehicleReports, fetchPeopleReports, fetchRevisionReports }
}