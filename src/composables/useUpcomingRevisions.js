import { ref, computed } from 'vue'
import { api } from '../lib/api'  

const ONE_DAY = 24 * 60 * 60 * 1000

function classifyStatus(predictedDate) {
  if (!predictedDate) return 'normal'

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const target = new Date(predictedDate)
  target.setHours(0, 0, 0, 0)

  const diffDays = Math.round((target - today) / ONE_DAY)

  if (diffDays < 0) return 'overdue'
  if (diffDays <= 7) return 'soon'
  return 'normal'
}

function formatDateLabel(predictedDate) {
  if (!predictedDate) return '—'

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(predictedDate))
}

function mapItem(row) {
  return {
    person_name: row.person_name,
    vehicle: row.vehicle,
    predicted_date_label: formatDateLabel(row.predicted_date),
    status: classifyStatus(row.predicted_date),
    origin_label: row.is_estimated_date ? 'Estimado' : 'Informado',
  }
}

export function useUpcomingRevisions() {
  const items = ref([])
  const isLoading = ref(false)
  const error = ref(null)

  const page = ref(1)
  const perPage = ref(15)
  const lastPage = ref(1)
  const total = ref(0)

  const hasPrevPage = computed(() => page.value > 1)
  const hasNextPage = computed(() => page.value < lastPage.value)

  async function fetchPage(targetPage = 1) {
    isLoading.value = true
    error.value = null

    try {
      const { data } = await api.get('/reports/revisions/upcoming', {
        params: { page: targetPage, per_page: perPage.value },
      })

      items.value = data.data.map(mapItem)
      page.value = data.current_page
      lastPage.value = data.last_page
      total.value = data.total
    } catch (err) {
      error.value = 'Não foi possível carregar as próximas revisões.'
      items.value = []
    } finally {
      isLoading.value = false
    }
  }

  function nextPage() {
    if (hasNextPage.value) fetchPage(page.value + 1)
  }

  function prevPage() {
    if (hasPrevPage.value) fetchPage(page.value - 1)
  }

  return {
    items,
    isLoading,
    error,
    page,
    perPage,
    lastPage,
    total,
    hasPrevPage,
    hasNextPage,
    fetchPage,
    nextPage,
    prevPage,
  }
}