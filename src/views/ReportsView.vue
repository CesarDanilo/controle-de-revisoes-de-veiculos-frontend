<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  BarChart3, Car, Users, Wrench, Calendar,
  DollarSign, Receipt, AlertCircle, RefreshCw, Download,
} from '@lucide/vue'
import AppShell from '../components/layout/AppShell.vue'
import EmptyState from '../components/dashboard/EmptyState.vue'
import ReportPanel from '../components/reports/ReportPanel.vue'
import ReportTable from '../components/reports/ReportTable.vue'
import BarChart from '../components/charts/BarChart.vue'
import DoughnutChart from '../components/charts/DoughnutChart.vue'
import KpiCard from '../components/reports/KpiCard.vue'
import RankingList from '../components/reports/RankingList.vue'
import UpcomingRevisionsPanel from '../components/reports/UpcomingRevisionsPanel.vue'
import RevisionsModal from '../components/people/RevisionsModal.vue'
import PersonFormModal from '../components/people/PersonFormModal.vue'
import VehicleFormModal from '../components/people/VehicleFormModal.vue'
import { useReports } from '../composables/useReports'
import { usePeople } from '../composables/usePeople'
import { useToast } from '../composables/useToast'
import { useReportExport } from '../composables/useReportExport'

import { maskPhone } from '../utils/masks'

// ---------------------------------------------------------------------
// EXPORTAÇÃO VIA FILA (único composable — controla todos os botões)
// ---------------------------------------------------------------------
// 🟢 NOVO — retryAfter/isOnCooldown vêm do composable e refletem o 429
// (limite/cooldown) retornado pelo backend.
const {
  exportReport,
  isRequesting: isQueueRequesting,
  isPolling: isQueuePolling,
  currentType,
  retryAfter,
  isOnCooldown,
} = useReportExport()

// 🔴 FIX — isExporting agora também considera o cooldown, senão os
// botões continuavam clicáveis durante os 30s de espera e disparavam
// outro 429 na cara do usuário.
const isExporting = computed(() => currentType.value !== null || isOnCooldown.value)
const isExportingFull = computed(() => currentType.value === 'full' || isOnCooldown.value)

const fullReportLabel = computed(() => {
  if (isOnCooldown.value) return `Aguarde ${retryAfter.value}s`
  if (currentType.value !== 'full') return 'Exportar relatório completo'
  if (isQueueRequesting.value) return 'Enfileirando...'
  if (isQueuePolling.value) return 'Gerando (fila)...'
  return 'Exportar relatório completo'
})

// 🟢 NOVO — labels dos demais botões, cada um checando o cooldown
// primeiro (mesmo padrão do fullReportLabel).
const overviewExportLabel = computed(() => {
  if (isOnCooldown.value) return `Aguarde ${retryAfter.value}s`
  return currentType.value === 'overview' ? 'Gerando...' : 'Baixar visão geral (PDF)'
})

const upcomingExportLabel = computed(() => {
  if (isOnCooldown.value) return `Aguarde ${retryAfter.value}s`
  return currentType.value === 'upcoming' ? 'Gerando...' : 'Baixar PDF'
})

const periodRevisionsExportLabel = computed(() => {
  if (isOnCooldown.value) return `Aguarde ${retryAfter.value}s`
  return currentType.value === 'period_revisions' ? 'Gerando...' : 'Baixar PDF'
})

const {
  data,
  revisionsSummary,
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
  fetchRevisionsPeriodSummary,
  fetchBrandsRevisionRanking,
  fetchPeopleRevisionRanking,
  fetchAvgIntervalByPerson,
  fetchUpcomingRevisions,
} = useReports()

const { updatePerson } = usePeople()
const toast = useToast()
const route = useRoute()

// ---- Formatação de data dd/mm/aaaa (sem risco de shift de timezone) ----
const formatDateBR = (value) => {
  if (!value) return '—'
  const isoPart = String(value).slice(0, 10)
  const match = isoPart.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return value
  const [, year, month, day] = match
  return `${day}/${month}/${year}`
}

const toISODate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ---- Rótulo de gênero com 3 categorias (M / F / Outros) ----
const GENDER_ORDER = ['M', 'F', 'OTHERS']
const GENDER_LABELS = { M: 'Homens', F: 'Mulheres', OTHERS: 'Outros' }
const GENDER_COLORS = { M: '#6366f1', F: '#f472b6', OTHERS: '#94a3b8' }

const normalizeGenderKey = (code) => (code === 'M' || code === 'F' ? code : 'OTHERS')

const aggregateByGender = (rows, countKey = 'count') => {
  const totals = { M: 0, F: 0, OTHERS: 0 }

  rows.forEach((row) => {
    const key = normalizeGenderKey(row.gender)
    totals[key] += Number(row[countKey] || 0)
  })

  return GENDER_ORDER
    .map((key) => ({
      key,
      label: GENDER_LABELS[key],
      value: totals[key],
      color: GENDER_COLORS[key],
    }))
    .filter((entry) => entry.value > 0)
}

// ---------------------------------------------------------------------
// FILTROS RÁPIDOS DE PERÍODO
// ---------------------------------------------------------------------
const PRESETS = [
  { key: 'today', label: 'Hoje', days: 0 },
  { key: '7d', label: '7 dias', days: 6 },
  { key: '30d', label: '30 dias', days: 29 },
  { key: '90d', label: '90 dias', days: 89 },
  { key: 'custom', label: 'Personalizado', days: null },
]

const activePreset = ref('30d')
const periodStart = ref('')
const periodEnd = ref('')

const periodLabel = computed(() => {
  const preset = PRESETS.find((p) => p.key === activePreset.value)
  if (preset && preset.key !== 'custom') return preset.label
  if (periodStart.value && periodEnd.value) {
    return `${formatDateBR(periodStart.value)} a ${formatDateBR(periodEnd.value)}`
  }
  return 'Período selecionado'
})

const applyPreset = (preset) => {
  activePreset.value = preset.key
  if (preset.key === 'custom') return

  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - preset.days)

  periodStart.value = toISODate(start)
  periodEnd.value = toISODate(end)
  fetchRevisionsByPeriod(periodStart.value, periodEnd.value, 1)
  fetchRevisionsPeriodSummary(periodStart.value, periodEnd.value)
  fetchBrandsRevisionRanking(periodStart.value, periodEnd.value)
  fetchPeopleRevisionRanking(periodStart.value, periodEnd.value)
}

const applyCustomPeriod = () => {
  activePreset.value = 'custom'
  fetchRevisionsByPeriod(periodStart.value, periodEnd.value, 1)
  fetchRevisionsPeriodSummary(periodStart.value, periodEnd.value)
  fetchBrandsRevisionRanking(periodStart.value, periodEnd.value)
  fetchPeopleRevisionRanking(periodStart.value, periodEnd.value)
}

// ---------------------------------------------------------------------
// CARGA INICIAL
// ---------------------------------------------------------------------
const loadAll = async () => {
  const initialEnd = new Date()
  const initialStart = new Date()
  initialStart.setDate(initialEnd.getDate() - 29)
  periodStart.value = toISODate(initialStart)
  periodEnd.value = toISODate(initialEnd)

  await Promise.all([
    fetchVehicleReports(),
    fetchPeopleReports(),
    fetchRevisionReports(periodStart.value, periodEnd.value),
    fetchAvgIntervalByPerson(),
  ])
}

const hasAnyData = computed(
  () => data.value.allVehicles.length || data.value.allPeople.length
)

// ---------------------------------------------------------------------
// PAGINAÇÃO — handlers de troca de página por tabela
// ---------------------------------------------------------------------
const handleVehiclesByPersonPage = (page) => fetchVehiclesByPerson(page)
const handleAllPeoplePage = (page) => fetchAllPeople(page)
const handleRevisionsByPeriodPage = (page) =>
  fetchRevisionsByPeriod(periodStart.value, periodEnd.value, page)
const handleAvgIntervalPage = (page) => fetchAvgIntervalByPerson(page)

// ---------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------
const kpiTotalRevisoes = computed(() => revisionsSummary.value.total_revisions)
const kpiVeiculosAtendidos = computed(() => revisionsSummary.value.vehicles_count)
const kpiClientesAtendidos = computed(() => revisionsSummary.value.people_count)
const kpiCustoTotal = computed(() => revisionsSummary.value.total_cost)
const kpiTicketMedio = computed(() =>
  kpiTotalRevisoes.value ? kpiCustoTotal.value / kpiTotalRevisoes.value : 0
)

const formatCurrency = (value) =>
  Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const buildUpcomingWithStatus = (rows) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const in7days = new Date(today)
  in7days.setDate(today.getDate() + 7)

  return rows
    .map((row) => {
      const predicted = row.predicted_date ? new Date(row.predicted_date) : null
      if (predicted) predicted.setHours(0, 0, 0, 0)

      let status = 'normal'
      if (predicted && predicted < today) status = 'overdue'
      else if (predicted && predicted.getTime() === today.getTime()) status = 'today'
      else if (predicted && predicted <= in7days) status = 'soon'

      return {
        ...row,
        predicted_date_label: formatDateBR(row.predicted_date),
        origin_label: row.is_estimated_date ? 'Estimado' : 'Informado',
        status,
        _rawDate: predicted,
      }
    })
    .sort((a, b) => (a._rawDate ?? Infinity) - (b._rawDate ?? Infinity))
}

const upcomingWithStatus = computed(() => buildUpcomingWithStatus(data.value.upcomingRevisions))

const kpiProximasRevisoes = computed(
  () => upcomingWithStatus.value.filter(
    (r) => r.status === 'overdue' || r.status === 'today' || r.status === 'soon'
  ).length
)

// ---------------------------------------------------------------------
// TABELAS FORMATADAS
// ---------------------------------------------------------------------
const revisionsByPeriodFormatted = computed(() =>
  data.value.revisionsByPeriod.map((row) => ({ ...row, date: formatDateBR(row.date) }))
)

const allPeopleFormatted = computed(() =>
  data.value.allPeople.map((row) => ({ ...row, phone: maskPhone(row.phone) }))
)

// ---------------------------------------------------------------------
// GRÁFICOS — 3 categorias de gênero
// ---------------------------------------------------------------------
const vehiclesByGenderChart = computed(() => {
  const aggregated = aggregateByGender(data.value.vehiclesByGender)
  return {
    labels: aggregated.map((g) => g.label),
    datasets: [{
      data: aggregated.map((g) => g.value),
      backgroundColor: aggregated.map((g) => g.color),
      borderWidth: 0,
    }],
  }
})

const peopleByGenderChart = computed(() => {
  const aggregated = aggregateByGender(data.value.peopleByGender)
  return {
    labels: aggregated.map((g) => g.label),
    datasets: [{
      data: aggregated.map((g) => g.value),
      backgroundColor: aggregated.map((g) => g.color),
      borderWidth: 0,
    }],
  }
})

const brandsByGenderChart = computed(() => ({
  labels: data.value.brandsByGender.map((b) => b.brand),
  datasets: [
    { label: 'Homens', data: data.value.brandsByGender.map((b) => b.male_count), backgroundColor: '#6366f1', borderRadius: 6 },
    { label: 'Mulheres', data: data.value.brandsByGender.map((b) => b.female_count), backgroundColor: '#f472b6', borderRadius: 6 },
    { label: 'Outros', data: data.value.brandsByGender.map((b) => b.other_count), backgroundColor: '#94a3b8', borderRadius: 6 },
  ],
}))

const brandsRevisionItems = computed(() =>
  data.value.brandsRevisionRanking.map((b) => ({ label: b.brand, value: b.count }))
)
const peopleRevisionItems = computed(() =>
  data.value.peopleRevisionRanking.map((p) => ({ label: p.person_name, value: p.count }))
)

const avgAgeMale = computed(() => data.value.peopleByGender.find((g) => g.gender === 'M')?.avg_age ?? '—')
const avgAgeFemale = computed(() => data.value.peopleByGender.find((g) => g.gender === 'F')?.avg_age ?? '—')

const detailTabs = [
  { key: 'revisions', label: 'Revisões', icon: Wrench },
  { key: 'vehicles', label: 'Veículos', icon: Car },
  { key: 'people', label: 'Pessoas', icon: Users },
]
const activeDetailTab = ref('revisions')

// ---------------------------------------------------------------------
// SCROLL AUTOMÁTICO PARA SEÇÃO VIA ÂNCORA
// ---------------------------------------------------------------------
// 🔧 CORRIGIDO — antes TODO hash de aba (#aba-revisoes/#aba-veiculos/
// #aba-pessoas) apontava sempre pro mesmo destino fixo
// ('secao-detalhes-tabs', o topo da barra de abas). Isso fazia o card
// "Revisões" do Dashboard, que usa '#aba-revisoes', cair sempre no topo
// da aba — ou seja, no painel "Tempo médio entre revisões" (primeiro
// da aba), nunca no painel "Revisões no período selecionado" (mais
// abaixo), que é o que faz sentido pra esse card.
//
// Agora cada hash carrega também o ID do elemento-alvo específico:
// - '#aba-revisoes' ativa a aba "revisions" e rola direto até o painel
//   "Revisões no período selecionado" (id="painel-revisoes-periodo").
// - '#aba-veiculos' / '#aba-pessoas' continuam rolando até o topo da
//   barra de abas, igual antes (não têm um painel "principal" óbvio).
const TAB_HASH_MAP = {
  '#aba-revisoes': { tab: 'revisions', targetId: 'painel-revisoes-periodo' },
  '#aba-veiculos': { tab: 'vehicles', targetId: 'secao-detalhes-tabs' },
  '#aba-pessoas': { tab: 'people', targetId: 'secao-detalhes-tabs' },
}

const isWindowContainer = (container) =>
  container === document.scrollingElement || container === document.documentElement

const getScrollContainer = (el) => {
  let node = el?.parentElement
  while (node && node !== document.body && node !== document.documentElement) {
    const style = window.getComputedStyle(node)
    const canScrollY = /(auto|scroll)/.test(style.overflowY)
    if (canScrollY && node.scrollHeight > node.clientHeight + 1) {
      return node
    }
    node = node.parentElement
  }
  return document.scrollingElement || document.documentElement
}

const getContainerScrollTop = (container) =>
  isWindowContainer(container) ? window.scrollY : container.scrollTop

const getContainerMaxScrollTop = (container) =>
  isWindowContainer(container)
    ? document.documentElement.scrollHeight - window.innerHeight
    : container.scrollHeight - container.clientHeight

const scrollContainerTo = (container, top) => {
  if (isWindowContainer(container)) {
    window.scrollTo({ top, behavior: 'smooth' })
  } else {
    container.scrollTo({ top, behavior: 'smooth' })
  }
}

const SCROLL_TOP_OFFSET_PX = -800

const scrollSpacerHeight = ref(0)

const waitForScrollToSettle = (container, target, { tolerance = 2, maxWait = 3000 } = {}) => {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    let lastY = getContainerScrollTop(container)
    let stableFrames = 0

    const check = () => {
      const currentY = getContainerScrollTop(container)
      const reachedTarget = Math.abs(currentY - target) <= tolerance
      const stoppedMoving = Math.abs(currentY - lastY) <= tolerance

      if (reachedTarget || Date.now() - startedAt > maxWait) {
        resolve()
        return
      }

      stableFrames = stoppedMoving ? stableFrames + 1 : 0
      lastY = currentY

      if (stableFrames > 10) {
        resolve()
        return
      }

      requestAnimationFrame(check)
    }

    requestAnimationFrame(check)
  })
}

const scrollToTarget = async (targetId) => {
  const el = document.getElementById(targetId)
  if (!el) return

  const container = getScrollContainer(el)
  const containerTopOnScreen = isWindowContainer(container)
    ? 0
    : container.getBoundingClientRect().top

  const elTopRelativeToContainer =
    el.getBoundingClientRect().top - containerTopOnScreen + getContainerScrollTop(container)

  const desiredTop = elTopRelativeToContainer - SCROLL_TOP_OFFSET_PX
  const maxScrollTop = getContainerMaxScrollTop(container)

  if (isWindowContainer(container)) {
    const missing = desiredTop - maxScrollTop
    if (missing > 0) {
      scrollSpacerHeight.value = Math.ceil(missing) + 24
      await nextTick()
    }
  }

  const target = Math.min(Math.max(desiredTop, 0), Math.max(getContainerMaxScrollTop(container), 0))
  scrollContainerTo(container, target)

  await waitForScrollToSettle(container, target)
  scrollSpacerHeight.value = 0
}

const scrollToHashSection = async () => {
  if (!route.hash) return

  const mapping = TAB_HASH_MAP[route.hash]
  if (mapping) activeDetailTab.value = mapping.tab

  await nextTick()
  const targetId = mapping ? mapping.targetId : route.hash.slice(1)
  await scrollToTarget(targetId)
}

watch(() => route.hash, scrollToHashSection)

watch(isLoading, (loading) => {
  if (!loading) scrollToHashSection()
})

// ---------------------------------------------------------------------
// MODAL DE REVISÕES
// ---------------------------------------------------------------------
const isRevisionsModalOpen = ref(false)
const selectedPerson = ref(null)
const highlightVehicleId = ref(null)
const highlightRevisionId = ref(null)

const openRevisionsModal = ({ personId, personName, vehicleId = null, revisionId = null }) => {
  if (!personId) return
  selectedPerson.value = { id: personId, name: personName }
  highlightVehicleId.value = vehicleId
  highlightRevisionId.value = revisionId
  isRevisionsModalOpen.value = true
}

const closeRevisionsModal = () => {
  isRevisionsModalOpen.value = false
  selectedPerson.value = null
  highlightVehicleId.value = null
  highlightRevisionId.value = null
}

const handleAvgIntervalRowClick = (row) => {
  openRevisionsModal({ personId: row.person_id, personName: row.person_name })
}

const handleRevisionsByPeriodRowClick = (row) => {
  openRevisionsModal({
    personId: row.person_id,
    personName: row.person_name,
    vehicleId: row.vehicle_id,
    revisionId: row.revision_id,
  })
}

// ---------------------------------------------------------------------
// MODAL DE CADASTRO/EDIÇÃO DE PESSOA
// ---------------------------------------------------------------------
const isPersonModalOpen = ref(false)
const editingPerson = ref(null)
const isSubmittingPerson = ref(false)

const openPersonModal = (person) => {
  editingPerson.value = person
  isPersonModalOpen.value = true
}

const closePersonModal = () => {
  isPersonModalOpen.value = false
  editingPerson.value = null
}

const handlePersonSubmit = async (payload) => {
  isSubmittingPerson.value = true
  try {
    await updatePerson(editingPerson.value.id, payload)
    toast.success('Pessoa atualizada com sucesso!')
    closePersonModal()
    await fetchAllPeople(pagination.allPeople.currentPage)
  } catch (error) {
    const rawMessage = error.response?.data?.message ?? error.response?.data?.error
    toast.error(rawMessage || 'Não foi possível salvar a pessoa.')
  } finally {
    isSubmittingPerson.value = false
  }
}

const handleAllPeopleRowClick = (row) => {
  openPersonModal(row)
}

// ---------------------------------------------------------------------
// MODAL DE VEÍCULOS DA PESSOA
// ---------------------------------------------------------------------
const isVehicleModalOpen = ref(false)
const personForVehicle = ref(null)
const highlightVehicleIdForModal = ref(null)

const openVehicleModal = (person, vehicleId = null) => {
  personForVehicle.value = person
  highlightVehicleIdForModal.value = vehicleId
  isVehicleModalOpen.value = true
}

const closeVehicleModal = async () => {
  isVehicleModalOpen.value = false
  personForVehicle.value = null
  highlightVehicleIdForModal.value = null
  await fetchVehiclesByPerson(pagination.vehiclesByPerson.currentPage)
}

const handleVehiclesByPersonRowClick = (row) => {
  openVehicleModal({ id: row.person_id, name: row.person_name }, row.vehicle_id)
}

// ---------------------------------------------------------------------
// EXPORTAÇÃO EM PDF (tudo via fila — um único ponto de controle: currentType)
// ---------------------------------------------------------------------
const exportOverviewPDF = async () => {
  try {
    await exportReport('overview', {
      start: periodStart.value,
      end: periodEnd.value,
      filename: `visao-geral-${periodStart.value}-a-${periodEnd.value}.pdf`,
    })
  } catch (error) {
    toast.error(error.message || 'Não foi possível gerar o relatório.')
  }
}

const exportUpcomingRevisionsPDF = async () => {
  try {
    await exportReport('upcoming', { filename: 'proximas-revisoes.pdf' })
  } catch (error) {
    toast.error(error.message || 'Não foi possível gerar o relatório.')
  }
}

const exportRevisionsByPeriodPDF = async () => {
  try {
    await exportReport('period_revisions', {
      start: periodStart.value,
      end: periodEnd.value,
      filename: `revisoes-periodo-${periodStart.value}-a-${periodEnd.value}.pdf`,
    })
  } catch (error) {
    toast.error(error.message || 'Não foi possível gerar o relatório.')
  }
}

const exportRevisionsTablePDF = async () => {
  try {
    await exportReport('revisions', {
      start: periodStart.value,
      end: periodEnd.value,
      filename: `revisoes-${periodStart.value}-a-${periodEnd.value}.pdf`,
    })
  } catch (error) {
    toast.error(error.message || 'Não foi possível gerar o relatório.')
  }
}

const exportVehiclesTablePDF = async () => {
  try {
    await exportReport('vehicles', { filename: 'veiculos.pdf' })
  } catch (error) {
    toast.error(error.message || 'Não foi possível gerar o relatório.')
  }
}

const exportPeopleTablePDF = async () => {
  try {
    await exportReport('people', { filename: 'pessoas.pdf' })
  } catch (error) {
    toast.error(error.message || 'Não foi possível gerar o relatório.')
  }
}

const exportFullReportPDFQueued = async () => {
  try {
    await exportReport('full', {
      start: periodStart.value,
      end: periodEnd.value,
      filename: `relatorio-completo-${periodStart.value}-a-${periodEnd.value}.pdf`,
    })
  } catch (error) {
    toast.error(error.message || 'Não foi possível gerar o relatório.')
  }
}

const activeTabExportHandler = computed(() => {
  if (activeDetailTab.value === 'vehicles') return exportVehiclesTablePDF
  if (activeDetailTab.value === 'people') return exportPeopleTablePDF
  return exportRevisionsTablePDF
})

const activeTabExportKey = computed(() => {
  if (activeDetailTab.value === 'vehicles') return 'vehicles'
  if (activeDetailTab.value === 'people') return 'people'
  return 'revisions'
})

const activeTabExportLabel = computed(() => {
  if (activeDetailTab.value === 'vehicles') return 'Veículos'
  if (activeDetailTab.value === 'people') return 'Pessoas'
  return 'Revisões'
})

// 🟢 NOVO — texto do botão "Baixar PDF - <aba ativa>", checando o
// cooldown antes de checar se está gerando.
const activeTabExportButtonLabel = computed(() => {
  if (isOnCooldown.value) return `Aguarde ${retryAfter.value}s`
  return currentType.value === activeTabExportKey.value
    ? 'Gerando...'
    : 'Baixar PDF - ' + activeTabExportLabel.value
})

onMounted(loadAll)
</script>

<template>
  <AppShell title="Relatórios" subtitle="Visão geral do sistema e histórico de revisões.">
    <template #actions>
      <button
        v-if="!isLoading && hasAnyData"
        type="button"
        class="flex w-full items-center justify-center gap-2 rounded-xl cursor-pointer bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        :disabled="isExportingFull"
        @click="exportFullReportPDFQueued"
      >
        <RefreshCw v-if="isExportingFull && !isOnCooldown" :size="16" class="animate-spin" />
        <Download v-else :size="16" />
        {{ fullReportLabel }}
      </button>
    </template>

    <div
      v-if="errorMessage"
      class="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
      role="alert"
    >
      <span class="flex items-center gap-2">
        <AlertCircle :size="16" />
        {{ errorMessage }}
      </span>
      <button
        type="button"
        class="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        @click="loadAll"
      >
        <RefreshCw :size="12" />
        Tentar novamente
      </button>
    </div>

    <EmptyState
      v-else-if="!isLoading && !hasAnyData"
      :icon="BarChart3"
      title="Sem dados suficientes"
      description="Os relatórios aparecerão aqui assim que houver pessoas, veículos e revisões cadastrados."
    />

    <template v-else>
      <div>
        <!-- ====== FILTROS RÁPIDOS + EXPORTAR VISÃO GERAL ====== -->
        <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Período do relatório">
            <button
              v-for="preset in PRESETS"
              :key="preset.key"
              type="button"
              class="rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
              :class="
                activePreset === preset.key
                  ? 'bg-brand-600 text-white'
                  : 'border border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
              "
              :aria-pressed="activePreset === preset.key"
              @click="applyPreset(preset)"
            >
              {{ preset.label }}
            </button>

            <template v-if="activePreset === 'custom'">
              <input v-model="periodStart" type="date" class="rounded-lg border border-ink-200 px-3 py-1.5 text-xs" aria-label="Data inicial" />
              <span class="text-xs text-ink-400">até</span>
              <input v-model="periodEnd" type="date" class="rounded-lg border border-ink-200 px-3 py-1.5 text-xs" aria-label="Data final" />
              <button
                type="button"
                class="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
                @click="applyCustomPeriod"
              >
                <Calendar :size="13" />
                Aplicar
              </button>
            </template>
          </div>

          <button
            type="button"
            class="flex shrink-0 items-center gap-1.5 rounded-lg cursor-pointer hover:bg-amber-50/50 border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600 transition-colors  disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            :disabled="isExporting"
            @click="exportOverviewPDF"
          >
            <RefreshCw v-if="currentType === 'overview' && !isOnCooldown" :size="13" class="animate-spin" />
            <Download v-else :size="13" />
            {{ overviewExportLabel }}
          </button>
        </div>

        <!-- ====== KPIs ====== -->
        <div
          id="secao-financeiro"
          class="mb-8 scroll-mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))"
        >
          <KpiCard label="Revisões" :value="kpiTotalRevisoes" :icon="Wrench" accent="brand" :loading="isLoading || tableLoading.revisionsSummary" />
          <KpiCard label="Veículos atendidos" :value="kpiVeiculosAtendidos" :icon="Car" accent="neutral" :loading="isLoading || tableLoading.revisionsSummary" />
          <KpiCard label="Clientes atendidos" :value="kpiClientesAtendidos" :icon="Users" accent="neutral" :loading="isLoading || tableLoading.revisionsSummary" />
          <KpiCard
            label="Próximas revisões"
            :value="kpiProximasRevisoes"
            :icon="AlertCircle"
            :accent="kpiProximasRevisoes > 0 ? 'warning' : 'success'"
            hint="atrasadas ou nos próx. 7 dias"
            :loading="isLoading"
          />
          <KpiCard label="Custo total" :value="formatCurrency(kpiCustoTotal)" :icon="DollarSign" accent="success" :loading="isLoading || tableLoading.revisionsSummary" />
          <KpiCard label="Ticket médio" :value="formatCurrency(kpiTicketMedio)" :icon="Receipt" accent="brand" :loading="isLoading || tableLoading.revisionsSummary" />
        </div>

        <!-- ====== RANKINGS ====== -->
        <div class="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ReportPanel title="Marcas com mais revisões" :description="periodLabel">
            <RankingList
              :items="brandsRevisionItems"
              accent-class="bg-green-500"
              :empty-label="`Nenhum dado no período selecionado (${periodLabel}) — experimente ampliar o intervalo.`"
            />
          </ReportPanel>

          <ReportPanel title="Clientes mais frequentes" :description="periodLabel">
            <RankingList
              :items="peopleRevisionItems"
              accent-class="bg-amber-500"
              :empty-label="`Nenhum dado no período selecionado (${periodLabel}) — experimente ampliar o intervalo.`"
            />
          </ReportPanel>
        </div>

        <!-- ====== GRÁFICOS DE GÊNERO ====== -->
        <div class="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ReportPanel title="Veículos por gênero" description="Todos os períodos">
            <DoughnutChart :chart-data="vehiclesByGenderChart" />
          </ReportPanel>

          <ReportPanel title="Pessoas por gênero" description="Todos os períodos">
            <DoughnutChart :chart-data="peopleByGenderChart" />
            <p class="mt-3 text-center text-xs text-ink-400">
              Idade média — homens: {{ avgAgeMale }} anos · mulheres: {{ avgAgeFemale }} anos
            </p>
          </ReportPanel>

          <ReportPanel title="Marcas por gênero" description="Todos os períodos">
            <p v-if="!data.brandsByGender.length" class="py-8 text-center text-sm text-ink-400">
              Nenhum dado disponível ainda. Assim que houver revisões de veículos com marca e gênero do proprietário cadastrados, a comparação aparece aqui.
            </p>
            <BarChart v-else :chart-data="brandsByGenderChart" />
          </ReportPanel>
        </div>

        <!-- ====== ALERTAS / PRÓXIMAS REVISÕES ====== -->
        <ReportPanel
          id="proximas-revisoes"
          title="Próximas revisões"
          description="Valor informado no cadastro ou, na ausência dele, estimativa com base no histórico do veículo."
          class="mb-8 scroll-mt-6"
        >
          <div class="mb-3 flex justify-end">
            <button
              type="button"
              class="flex items-center gap-1.5 rounded-lg cursor-pointer hover:bg-amber-50/50 border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600 transition-colors hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              :disabled="isExporting"
              @click="exportUpcomingRevisionsPDF"
            >
              <RefreshCw v-if="currentType === 'upcoming' && !isOnCooldown" :size="13" class="animate-spin" />
              <Download v-else :size="13" />
              {{ upcomingExportLabel }}
            </button>
          </div>
          <UpcomingRevisionsPanel :items="upcomingWithStatus" />
        </ReportPanel>
      </div>

      <!-- ====== TABELAS DETALHADAS ====== -->
      <div id="secao-detalhes" class="scroll-mt-6">
        <div id="secao-detalhes-tabs" class="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-ink-100">
          <div class="flex gap-2">
            <button
              v-for="tab in detailTabs"
              :key="tab.key"
              type="button"
              class="flex items-center gap-2 border-b-2 px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
              :class="
                activeDetailTab === tab.key
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-ink-400 hover:text-ink-700'
              "
              :aria-pressed="activeDetailTab === tab.key"
              @click="activeDetailTab = tab.key"
            >
              <component :is="tab.icon" :size="15" />
              {{ tab.label }}
            </button>
          </div>

          <button
            type="button"
            class="mb-2 flex shrink-0 items-center gap-1.5 rounded-lg cursor-pointer hover:bg-amber-50/50 border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600 transition-colors hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            :disabled="isExporting"
            @click="activeTabExportHandler()"
          >
            <RefreshCw v-if="currentType === activeTabExportKey && !isOnCooldown" :size="13" class="animate-spin" />
            <Download v-else :size="13" />
            {{ activeTabExportButtonLabel }}
          </button>
        </div>

        <div>
          <div v-if="activeDetailTab === 'revisions'" class="flex flex-col gap-6">
            <ReportPanel title="Tempo médio entre revisões" description="Média de dias entre visitas, por pessoa (considerando todos os veículos dela)">
              <ReportTable
                :columns="[
                  { key: 'person_name', label: 'Pessoa' },
                  { key: 'avg_days', label: 'Média (dias)' },
                ]"
                :rows="data.avgIntervalByPerson"
                :pagination="pagination.avgIntervalByPerson"
                :loading="tableLoading.avgIntervalByPerson"
                row-clickable
                @page-change="handleAvgIntervalPage"
                @row-click="handleAvgIntervalRowClick"
              />
            </ReportPanel>

            <ReportPanel id="painel-revisoes-periodo" title="Revisões no período selecionado" class="scroll-mt-6">
              <div class="mb-3 flex justify-end">
                <button
                  type="button"
                  class="flex items-center gap-1.5 rounded-lg cursor-pointer hover:bg-amber-50/50 border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600 transition-colors hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  :disabled="isExporting"
                  @click="exportRevisionsByPeriodPDF"
                >
                  <RefreshCw v-if="currentType === 'period_revisions' && !isOnCooldown" :size="13" class="animate-spin" />
                  <Download v-else :size="13" />
                  {{ periodRevisionsExportLabel }}
                </button>
              </div>
              <p v-if="!revisionsByPeriodFormatted.length" class="py-6 text-center text-sm text-ink-400">
                Nenhuma revisão encontrada nesse período.
              </p>
              <ReportTable
                v-else
                :columns="[
                  { key: 'date', label: 'Data' },
                  { key: 'person_name', label: 'Pessoa' },
                  { key: 'vehicle', label: 'Veículo' },
                  { key: 'description', label: 'Descrição' },
                ]"
                :rows="revisionsByPeriodFormatted"
                :pagination="pagination.revisionsByPeriod"
                :loading="tableLoading.revisionsByPeriod"
                row-clickable
                @page-change="handleRevisionsByPeriodPage"
                @row-click="handleRevisionsByPeriodRowClick"
              />
            </ReportPanel>
          </div>

          <ReportPanel v-else-if="activeDetailTab === 'vehicles'" title="Todos os veículos por pessoa">
            <ReportTable
              :columns="[
                { key: 'person_name', label: 'Proprietário' },
                { key: 'plate', label: 'Placa' },
                { key: 'model', label: 'Modelo' },
                { key: 'brand', label: 'Marca' },
              ]"
              :rows="data.vehiclesByPerson"
              :pagination="pagination.vehiclesByPerson"
              :loading="tableLoading.vehiclesByPerson"
              row-clickable
              @page-change="handleVehiclesByPersonPage"
              @row-click="handleVehiclesByPersonRowClick"
            />
          </ReportPanel>

          <ReportPanel v-else title="Todas as pessoas">
            <ReportTable
              :columns="[
                { key: 'name', label: 'Nome' },
                { key: 'email', label: 'E-mail' },
                { key: 'phone', label: 'Telefone' },
              ]"
              :rows="allPeopleFormatted"
              :pagination="pagination.allPeople"
              :loading="tableLoading.allPeople"
              row-clickable
              @page-change="handleAllPeoplePage"
              @row-click="handleAllPeopleRowClick"
            />
          </ReportPanel>
        </div>
      </div>

      <div :style="{ height: scrollSpacerHeight + 'px' }" aria-hidden="true" />
    </template>

    <RevisionsModal
      v-if="isRevisionsModalOpen"
      :person="selectedPerson"
      :highlight-vehicle-id="highlightVehicleId"
      :highlight-revision-id="highlightRevisionId"
      @close="closeRevisionsModal"
      @register-vehicle="closeRevisionsModal"
    />

    <PersonFormModal
      v-if="isPersonModalOpen"
      :person="editingPerson"
      :is-submitting="isSubmittingPerson"
      @close="closePersonModal"
      @submit="handlePersonSubmit"
    />

    <VehicleFormModal
      v-if="isVehicleModalOpen"
      :person="personForVehicle"
      :highlight-vehicle-id="highlightVehicleIdForModal"
      @close="closeVehicleModal"
    />
  </AppShell>
</template>