<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  BarChart3, Car, Users, Wrench, Calendar,
  DollarSign, Receipt, AlertCircle, RefreshCw,
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
import { useReports } from '../composables/useReports'
import { maskPhone } from '../utils/masks'

const { data, isLoading, errorMessage, fetchVehicleReports, fetchPeopleReports, fetchRevisionReports } =
  useReports()

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
// Antes o código assumia só M/F com um ternário, o que jogava qualquer
// valor diferente de 'M' (incluindo "Outros") dentro do rótulo "Mulheres".
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
  fetchRevisionReports(periodStart.value, periodEnd.value)
}

const applyCustomPeriod = () => {
  activePreset.value = 'custom'
  fetchRevisionReports(periodStart.value, periodEnd.value)
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
  ])
}

onMounted(loadAll)

const hasAnyData = computed(
  () => data.value.allVehicles.length || data.value.allPeople.length
)

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
// GRÁFICOS — agora com 3 categorias de gênero
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

// Rankings — "Marcas mais cadastradas" removido (não faz sentido pra
// contas individuais, cada cliente cadastra poucas marcas próprias)
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
</script>

<template>
  <AppShell title="Relatórios" subtitle="Visão geral do sistema e histórico de revisões.">
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
      <!-- grid mais gradual (1 -> 2 -> 3 -> 6 colunas) pra dar mais largura
           ao card em telas pequenas, complementando o fix de truncate -->
      <div class="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))">
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

      <!-- ====== RANKINGS (sem "marcas mais cadastradas") ====== -->
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
      <ReportPanel
        title="Próximas revisões"
        description="Valor informado no cadastro ou, na ausência dele, estimativa com base no histórico do veículo."
        class="mb-8"
      >
        <UpcomingRevisionsPanel :items="upcomingWithStatus" />
      </ReportPanel>

      <!-- ====== TABELAS DETALHADAS ====== -->
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

      <div v-if="activeDetailTab === 'revisions'" class="flex flex-col gap-6">
        <ReportPanel title="Tempo médio entre revisões" description="Média de dias entre visitas, por pessoa (considerando todos os veículos dela)">
          <ReportTable
            :columns="[
              { key: 'person_name', label: 'Pessoa' },
              { key: 'avg_days', label: 'Média (dias)' },
            ]"
            :rows="data.avgIntervalByPerson"
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
        />
      </ReportPanel>
    </template>
  </AppShell>
</template>