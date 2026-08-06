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
  if (diffDays === 0) return 'today' // 🔧 CORRIGIDO — antes caía direto em 'soon'
  if (diffDays <= 7) return 'soon'
  return 'normal'
}

function formatDateLabel(predictedDate) {
  if (!predictedDate) return '—'

  // 🔴 AQUI — adicionado "year: 'numeric'", antes só mostrava dia e mês
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(predictedDate))
}

// 🔧 CORRIGIDO — antes o dedupe só removia duplicata quando VEÍCULO + DATA
// batiam exatamente. Mas o mesmo veículo pode ter previsões futuras
// diferentes (ex: uma "informada" pra uma data vinda de uma revisão antiga,
// e uma "agendada" pra outra data vinda de uma revisão real já cadastrada)
// — nesse caso a lista mostrava as DUAS, quando só faz sentido mostrar a
// PRÓXIMA revisão de fato daquele veículo.
//
// Regra nova: agrupa só por veículo (ignora a data no agrupamento) e
// mantém a entrada com a data mais PRÓXIMA — seja ela informada, estimada
// ou agendada. Em caso de empate exato de data, a agendada vence (é um
// registro real, não um palpite).
function dedupeByVehicleKeepNearest(rows) {
  const map = new Map()

  for (const row of rows) {
    const key = row.vehicle_id
    const existing = map.get(key)

    if (!existing) {
      map.set(key, row)
      continue
    }

    const existingDate = existing.predicted_date ? new Date(existing.predicted_date) : null
    const rowDate = row.predicted_date ? new Date(row.predicted_date) : null

    if (!rowDate) continue

    if (!existingDate || rowDate < existingDate) {
      map.set(key, row)
      continue
    }

    if (rowDate.getTime() === existingDate.getTime() && row.is_scheduled && !existing.is_scheduled) {
      map.set(key, row)
    }
  }

  // reordena por data prevista, já que a remoção de itens pode ter
  // desordenado a lista original vinda da API
  return Array.from(map.values()).sort((a, b) => {
    const dateA = a.predicted_date ? new Date(a.predicted_date) : null
    const dateB = b.predicted_date ? new Date(b.predicted_date) : null
    if (!dateA) return 1
    if (!dateB) return -1
    return dateA - dateB
  })
}

function mapItem(row) {
  return {
    // 🔴 AQUI — ids necessários para permitir clique -> abrir RevisionsModal
    // já destacando a revisão certa. Vêm do ReportController::upcomingRevisions.
    person_id: row.person_id,
    vehicle_id: row.vehicle_id,
    revision_id: row.revision_id,
    person_name: row.person_name,
    vehicle: row.vehicle,
    predicted_date_label: formatDateLabel(row.predicted_date),
    status: classifyStatus(row.predicted_date),
    origin_label: row.is_estimated_date ? 'Estimado' : 'Informado',
    // 🟡 MANTIDO — necessários pra decidir, ao clicar, entre abrir a revisão
    // futura REAL em modo edição (quando is_scheduled = true) ou abrir o
    // formulário de criação pré-preenchido (quando é só uma previsão).
    // Ver UpcomingRevisionsPanel.vue::handleSelect.
    predicted_date: row.predicted_date,
    predicted_km: row.predicted_km,
    is_scheduled: row.is_scheduled,
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

      // 🔧 CORRIGIDO — usa dedupeByVehicleKeepNearest, que mantém só a
      // previsão mais próxima por veículo (em vez de uma por veículo+data),
      // na página atual.
      items.value = dedupeByVehicleKeepNearest(data.data).map(mapItem)
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