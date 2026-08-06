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
  if (diffDays === 0) return 'today'
  if (diffDays <= 7) return 'soon'
  return 'normal'
}

function formatDateLabel(predictedDate) {
  if (!predictedDate) return '—'

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(predictedDate))
}

// 🔧 CORRIGIDO — antes (dedupeByVehicleKeepNearest) reduzia todas as
// previsões de um mesmo veículo a UMA SÓ (a mais próxima), descartando as
// demais silenciosamente. Isso escondia do usuário o fato de existir mais
// de uma revisão pendente pro mesmo veículo no mesmo período. Agora
// agrupa por veículo SEM descartar nada — cada grupo carrega todas as
// previsões daquele veículo, ordenadas da mais próxima pra mais distante
// (empate de data: agendada vence, por ser um registro real, não um
// palpite).
function groupByVehicle(rows) {
  const map = new Map()

  for (const row of rows) {
    const key = row.vehicle_id
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(row)
  }

  const groups = Array.from(map.values()).map((rowsForVehicle) =>
    [...rowsForVehicle].sort((a, b) => {
      const dateA = a.predicted_date ? new Date(a.predicted_date) : null
      const dateB = b.predicted_date ? new Date(b.predicted_date) : null
      if (!dateA) return 1
      if (!dateB) return -1
      if (dateA.getTime() === dateB.getTime()) {
        if (a.is_scheduled && !b.is_scheduled) return -1
        if (!a.is_scheduled && b.is_scheduled) return 1
        return 0
      }
      return dateA - dateB
    })
  )

  // ordena os grupos entre si pela previsão mais próxima de cada um
  return groups.sort((a, b) => {
    const dateA = a[0]?.predicted_date ? new Date(a[0].predicted_date) : null
    const dateB = b[0]?.predicted_date ? new Date(b[0].predicted_date) : null
    if (!dateA) return 1
    if (!dateB) return -1
    return dateA - dateB
  })
}

// 🔧 CORRIGIDO — mapItem virou mapGroup: recebe TODAS as previsões de um
// veículo (já ordenadas por groupByVehicle) e monta um item cujo topo
// reflete a previsão mais próxima (mantendo compatibilidade com quem lia
// person_id/vehicle_id/predicted_date direto no item), mas agora também
// carrega `predictions` (a lista completa) e `predictions_count`, usados
// pelo UpcomingRevisionsPanel pra decidir se abre direto a revisão ou
// primeiro um modal de escolha.
function mapGroup(rowsForVehicle) {
  const nearest = rowsForVehicle[0]

  const predictions = rowsForVehicle.map((row) => ({
    revision_id: row.revision_id,
    predicted_date: row.predicted_date,
    predicted_km: row.predicted_km,
    is_estimated_date: row.is_estimated_date,
    is_scheduled: row.is_scheduled,
    predicted_date_label: formatDateLabel(row.predicted_date),
    origin_label: row.is_estimated_date ? 'Estimado' : 'Informado',
  }))

  return {
    person_id: nearest.person_id,
    vehicle_id: nearest.vehicle_id,
    revision_id: nearest.revision_id,
    person_name: nearest.person_name,
    vehicle: nearest.vehicle,
    predicted_date_label: formatDateLabel(nearest.predicted_date),
    status: classifyStatus(nearest.predicted_date),
    origin_label: nearest.is_estimated_date ? 'Estimado' : 'Informado',
    predicted_date: nearest.predicted_date,
    predicted_km: nearest.predicted_km,
    is_scheduled: nearest.is_scheduled,
    // 🟢 NOVO
    predictions,
    predictions_count: predictions.length,
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

      // 🔧 CORRIGIDO — agrupa por veículo sem descartar previsões
      items.value = groupByVehicle(data.data).map(mapGroup)
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