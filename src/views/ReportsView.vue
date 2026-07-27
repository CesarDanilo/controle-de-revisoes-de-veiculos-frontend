<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  BarChart3, Car, Users, Wrench, Calendar,
  DollarSign, Receipt, AlertCircle, RefreshCw, Download,
} from '@lucide/vue'
import jsPDF from 'jspdf'
// 🔴 AQUI — usamos o fork "pro" porque o html2canvas original não sabe ler
// cores em oklch()/lab(), que é o formato que o Tailwind v4 gera por padrão.
// Sem isso, a captura falha silenciosamente pra qualquer elemento estilizado com Tailwind.
import html2canvas from 'html2canvas-pro'
import AppShell from '../components/layout/AppShell.vue'
import EmptyState from '../components/dashboard/EmptyState.vue'
import ReportPanel from '../components/reports/ReportPanel.vue'
import ReportTable from '../components/reports/ReportTable.vue'
import BarChart from '../components/charts/BarChart.vue'
import DoughnutChart from '../components/charts/DoughnutChart.vue'
import KpiCard from '../components/reports/KpiCard.vue'
import RankingList from '../components/reports/RankingList.vue'
import UpcomingRevisionsPanel from '../components/reports/UpcomingRevisionsPanel.vue'
// 🔴 AQUI — mesmo modal já usado na tela de Pessoas e no painel de "Próximas revisões"
import RevisionsModal from '../components/people/RevisionsModal.vue'
// 🔴 AQUI — mesmo modal de cadastro/edição de pessoa usado na tela de Pessoas
import PersonFormModal from '../components/people/PersonFormModal.vue'
// 🔴 AQUI — mesmo modal de veículos (lista + cadastro/edição) usado na tela de Pessoas
import VehicleFormModal from '../components/people/VehicleFormModal.vue'
import { useReports } from '../composables/useReports'
import { usePeople } from '../composables/usePeople'
import { useToast } from '../composables/useToast'
import { maskPhone } from '../utils/masks'

const {
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
} = useReports()

// 🔴 AQUI — usado apenas para salvar a edição de pessoa aberta a partir dos relatórios
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
const GENDER_LABELS = { M: 'Homens', F: 'Mulheres' }
const genderLabel = (code) => GENDER_LABELS[code] || 'Outros'
const GENDER_COLORS = { M: '#6366f1', F: '#f472b6' }
const genderColor = (code) => GENDER_COLORS[code] || '#94a3b8' // slate neutro pra "Outros"

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

const applyPreset = (preset) => {
  activePreset.value = preset.key
  if (preset.key === 'custom') return

  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - preset.days)

  periodStart.value = toISODate(start)
  periodEnd.value = toISODate(end)
  // Só a tabela de revisões do período depende do filtro de datas —
  // rankings e intervalo médio são "todos os períodos", não precisam recarregar.
  fetchRevisionsByPeriod(periodStart.value, periodEnd.value, 1)
}

const applyCustomPeriod = () => {
  activePreset.value = 'custom'
  fetchRevisionsByPeriod(periodStart.value, periodEnd.value, 1)
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
const kpiTotalRevisoes = computed(() => data.value.revisionsByPeriod.length)

const kpiVeiculosAtendidos = computed(
  () => new Set(data.value.revisionsByPeriod.map((r) => r.vehicle)).size
)

const kpiClientesAtendidos = computed(
  () => new Set(data.value.revisionsByPeriod.map((r) => r.person_name)).size
)

const kpiCustoTotal = computed(() =>
  data.value.revisionsByPeriod.reduce((sum, r) => sum + Number(r.cost || 0), 0)
)

const kpiTicketMedio = computed(() =>
  kpiTotalRevisoes.value ? kpiCustoTotal.value / kpiTotalRevisoes.value : 0
)

const formatCurrency = (value) =>
  Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const upcomingWithStatus = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const in7days = new Date(today)
  in7days.setDate(today.getDate() + 7)

  return data.value.upcomingRevisions
    .map((row) => {
      const predicted = row.predicted_date ? new Date(row.predicted_date) : null
      let status = 'normal'
      if (predicted && predicted < today) status = 'overdue'
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
})

const kpiProximasRevisoes = computed(
  () => upcomingWithStatus.value.filter((r) => r.status === 'overdue' || r.status === 'soon').length
)

// ---------------------------------------------------------------------
// TABELAS FORMATADAS
// ---------------------------------------------------------------------
const revisionsByPeriodFormatted = computed(() =>
  data.value.revisionsByPeriod.map((row) => ({ ...row, date: formatDateBR(row.date) }))
)

// Telefone chega do backend só com dígitos (ex: "11987654321"); aplica a
// mesma máscara usada no formulário de cadastro pra exibir "(00) 00000-0000".
const allPeopleFormatted = computed(() =>
  data.value.allPeople.map((row) => ({ ...row, phone: maskPhone(row.phone) }))
)

// ---------------------------------------------------------------------
// GRÁFICOS — 3 categorias de gênero
// ---------------------------------------------------------------------
const vehiclesByGenderChart = computed(() => ({
  labels: data.value.vehiclesByGender.map((g) => genderLabel(g.gender)),
  datasets: [{
    data: data.value.vehiclesByGender.map((g) => g.count),
    backgroundColor: data.value.vehiclesByGender.map((g) => genderColor(g.gender)),
    borderWidth: 0,
  }],
}))

const peopleByGenderChart = computed(() => ({
  labels: data.value.peopleByGender.map((g) => genderLabel(g.gender)),
  datasets: [{
    data: data.value.peopleByGender.map((g) => g.count),
    backgroundColor: data.value.peopleByGender.map((g) => genderColor(g.gender)),
    borderWidth: 0,
  }],
}))

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
// 🟢 NOVO — usado pelos links "Ver relatório" dos StatCards no Dashboard e
// pelo link "Ver relatórios" do UpcomingRevisionsCard.
//
// Duas famílias de âncora:
// - Seções fixas, sempre no DOM: "#proximas-revisoes", "#secao-financeiro"
//   -> só rola até o id.
// - Abas de detalhe, controladas por estado (activeDetailTab), não por
//   rota: "#aba-veiculos", "#aba-pessoas", "#aba-revisoes" -> primeiro
//   troca a aba ativa, só então rola até o container "#secao-detalhes"
//   (só a aba ativa está no DOM por vez, então não dá pra apontar um id
//   fixo direto pra dentro de cada aba).
const TAB_HASH_MAP = {
  '#aba-revisoes': 'revisions',
  '#aba-veiculos': 'vehicles',
  '#aba-pessoas': 'people',
}

const scrollToHashSection = async () => {
  if (!route.hash) return

  const tabKey = TAB_HASH_MAP[route.hash]
  if (tabKey) activeDetailTab.value = tabKey

  await nextTick()
  const targetId = tabKey ? 'secao-detalhes' : route.hash.slice(1)
  const el = document.getElementById(targetId)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// cobre o caso de vir de outra rota com o hash já na URL, ou de já estar em
// /relatorios e clicar de novo no link (o hash muda mas o componente não remonta)
watch(() => route.hash, scrollToHashSection)

// cobre o caso de a página já estar carregada (ex: cache do vue-query) e o
// hash já vir presente logo no mount
watch(isLoading, (loading) => {
  if (!loading) scrollToHashSection()
})

// ---------------------------------------------------------------------
// MODAL DE REVISÕES — aberto ao clicar em uma linha das tabelas de revisões
// ---------------------------------------------------------------------
const isRevisionsModalOpen = ref(false)
const selectedPerson = ref(null)
const highlightVehicleId = ref(null)
const highlightRevisionId = ref(null)

const openRevisionsModal = ({ personId, personName, vehicleId = null, revisionId = null }) => {
  if (!personId) return // sem person_id não dá pra abrir o modal
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

// "Tempo médio entre revisões" — sem revisão específica, abre a listagem normal da pessoa
const handleAvgIntervalRowClick = (row) => {
  openRevisionsModal({ personId: row.person_id, personName: row.person_name })
}

// "Revisões no período selecionado" — tem a revisão exata, abre já em modo edição
const handleRevisionsByPeriodRowClick = (row) => {
  openRevisionsModal({
    personId: row.person_id,
    personName: row.person_name,
    vehicleId: row.vehicle_id,
    revisionId: row.revision_id,
  })
}

// ---------------------------------------------------------------------
// MODAL DE CADASTRO/EDIÇÃO DE PESSOA — aberto ao clicar em uma linha da aba "Pessoas"
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
    // recarrega a página atual da tabela pra refletir a edição
    await fetchAllPeople(pagination.allPeople.currentPage)
  } catch (error) {
    const rawMessage = error.response?.data?.message ?? error.response?.data?.error
    toast.error(rawMessage || 'Não foi possível salvar a pessoa.')
  } finally {
    isSubmittingPerson.value = false
  }
}

// "Todas as pessoas" — abre o modal de edição da pessoa clicada
const handleAllPeopleRowClick = (row) => {
  openPersonModal(row)
}

// ---------------------------------------------------------------------
// MODAL DE VEÍCULOS DA PESSOA — aberto ao clicar em uma linha da aba "Veículos",
// já em modo edição do veículo clicado
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
  // recarrega a página atual da tabela pra refletir qualquer edição feita no modal
  await fetchVehiclesByPerson(pagination.vehiclesByPerson.currentPage)
}

// "Todos os veículos por pessoa" — abre o modal já em edição no veículo clicado
const handleVehiclesByPersonRowClick = (row) => {
  openVehicleModal({ id: row.person_id, name: row.person_name }, row.vehicle_id)
}

// ---------------------------------------------------------------------
// EXPORTAÇÃO EM PDF — client-side, com html2canvas + jsPDF
// ---------------------------------------------------------------------
const isExporting = ref(false)
const overviewRef = ref(null) // filtros + KPIs + rankings + gráficos + próximas revisões
const detailRef = ref(null)   // conteúdo da aba de detalhe ativa (revisões/veículos/pessoas)

// Fatia um canvas alto em quantas páginas A4 forem necessárias e as adiciona ao PDF.
// Evita imagem cortada/esticada quando o conteúdo (ex: tabela grande) é mais alto que uma página.
const addCanvasPaginated = (pdf, canvas, margin = 10) => {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const usableWidth = pageWidth - margin * 2
  const usableHeight = pageHeight - margin * 2

  const pxPerMm = canvas.width / usableWidth
  const pageHeightPx = Math.floor(usableHeight * pxPerMm)

  let renderedHeight = 0
  let isFirstSlice = true

  while (renderedHeight < canvas.height) {
    const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedHeight)

    const sliceCanvas = document.createElement('canvas')
    sliceCanvas.width = canvas.width
    sliceCanvas.height = sliceHeightPx
    const ctx = sliceCanvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height)
    ctx.drawImage(canvas, 0, renderedHeight, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx)

    const imgData = sliceCanvas.toDataURL('image/png')
    const sliceHeightMm = sliceHeightPx / pxPerMm

    if (!isFirstSlice) pdf.addPage()
    pdf.addImage(imgData, 'PNG', margin, margin, usableWidth, sliceHeightMm)

    renderedHeight += sliceHeightPx
    isFirstSlice = false
  }
}

const captureSection = (el) =>
  html2canvas(el, {
    scale: 2, // melhora nitidez do texto/gráficos no PDF
    useCORS: true,
    backgroundColor: '#ffffff',
  })

const exportToPDF = async () => {
  if (isExporting.value || !overviewRef.value) return
  isExporting.value = true
  const originalTab = activeDetailTab.value

  try {
    const pdf = new jsPDF('p', 'mm', 'a4')

    // 1) Visão geral: filtros, KPIs, rankings, gráficos e próximas revisões
    await nextTick()
    const overviewCanvas = await captureSection(overviewRef.value)
    addCanvasPaginated(pdf, overviewCanvas)

    // 2) Uma seção por aba de detalhe (revisões, veículos, pessoas)
    for (const tab of detailTabs) {
      activeDetailTab.value = tab.key
      await nextTick()
      // pequena espera pra tabela/gráfico da aba renderizar de fato antes de capturar
      await new Promise((resolve) => setTimeout(resolve, 150))

      if (!detailRef.value) continue
      const detailCanvas = await captureSection(detailRef.value)
      pdf.addPage()
      addCanvasPaginated(pdf, detailCanvas)
    }

    pdf.save(`relatorio-geral-${toISODate(new Date())}.pdf`)
  } catch (error) {
    console.error('Erro ao gerar PDF:', error)
    toast.error(`Não foi possível gerar o PDF: ${error?.message || 'erro desconhecido'}`)
  } finally {
    activeDetailTab.value = originalTab
    await nextTick()
    isExporting.value = false
  }
}
// --- fim exportação PDF ---

onMounted(loadAll)
</script>

<template>
  <AppShell title="Relatórios" subtitle="Visão geral do sistema e histórico de revisões.">
    <template #actions>
      <button
        v-if="!isLoading && hasAnyData"
        type="button"
        class="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        :disabled="isExporting"
        @click="exportToPDF"
      >
        <RefreshCw v-if="isExporting" :size="16" class="animate-spin" />
        <Download v-else :size="16" />
        {{ isExporting ? 'Gerando PDF...' : 'Exportar PDF' }}
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
      <div ref="overviewRef">
        <!-- ====== FILTROS RÁPIDOS ====== -->
        <div class="mb-6 flex flex-wrap items-center gap-2" role="group" aria-label="Período do relatório">
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

        <!-- ====== KPIs ====== -->
        <!-- 🟢 id usado como âncora de scroll (#secao-financeiro),
             alvo do card "Investido" no Dashboard -->
        <div
          id="secao-financeiro"
          class="mb-8 scroll-mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))"
        >
          <KpiCard label="Revisões" :value="kpiTotalRevisoes" :icon="Wrench" accent="brand" :loading="isLoading" />
          <KpiCard label="Veículos atendidos" :value="kpiVeiculosAtendidos" :icon="Car" accent="neutral" :loading="isLoading" />
          <KpiCard label="Clientes atendidos" :value="kpiClientesAtendidos" :icon="Users" accent="neutral" :loading="isLoading" />
          <KpiCard
            label="Próximas revisões"
            :value="kpiProximasRevisoes"
            :icon="AlertCircle"
            :accent="kpiProximasRevisoes > 0 ? 'warning' : 'success'"
            hint="atrasadas ou nos próx. 7 dias"
            :loading="isLoading"
          />
          <KpiCard label="Custo total" :value="formatCurrency(kpiCustoTotal)" :icon="DollarSign" accent="success" :loading="isLoading" />
          <KpiCard label="Ticket médio" :value="formatCurrency(kpiTicketMedio)" :icon="Receipt" accent="brand" :loading="isLoading" />
        </div>

        <!-- ====== RANKINGS ====== -->
        <div class="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ReportPanel title="Marcas com mais revisões" description="Todos os períodos">
            <RankingList :items="brandsRevisionItems" accent-class="bg-green-500" />
          </ReportPanel>

          <ReportPanel title="Clientes mais frequentes" description="Todos os períodos">
            <RankingList :items="peopleRevisionItems" accent-class="bg-amber-500" />
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
            <BarChart :chart-data="brandsByGenderChart" />
          </ReportPanel>
        </div>

        <!-- ====== ALERTAS / PRÓXIMAS REVISÕES ====== -->
        <!-- 🟢 id usado como âncora de scroll (#proximas-revisoes),
             alvo do link "Ver relatórios" no UpcomingRevisionsCard e do
             card "Revisões" no Dashboard -->
        <ReportPanel
          id="proximas-revisoes"
          title="Próximas revisões"
          description="Valor informado no cadastro ou, na ausência dele, estimativa com base no histórico do veículo."
          class="mb-8 scroll-mt-6"
        >
          <UpcomingRevisionsPanel :items="upcomingWithStatus" />
        </ReportPanel>
      </div>

      <!-- ====== TABELAS DETALHADAS ====== -->
      <!-- 🟢 NOVO — id usado como âncora de scroll ("#secao-detalhes"),
           alvo indireto dos cards "Pessoas" e "Veículos" no Dashboard.
           Eles apontam pra "#aba-pessoas" / "#aba-veiculos", que trocam
           activeDetailTab (ver TAB_HASH_MAP) e então rolam pra cá. -->
      <div id="secao-detalhes" class="scroll-mt-6">
        <div class="mb-4 flex gap-2 border-b border-ink-100">
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

        <div ref="detailRef">
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

            <ReportPanel title="Revisões no período selecionado">
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