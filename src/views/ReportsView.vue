<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { BarChart3, Car, Users, Wrench, TrendingUp, Calendar } from '@lucide/vue'
import AppShell from '../components/layout/AppShell.vue'
import EmptyState from '../components/dashboard/EmptyState.vue'
import StatCard from '../components/reports/StatCard.vue'
import ReportPanel from '../components/reports/ReportPanel.vue'
import ReportTable from '../components/reports/ReportTable.vue'
import BarChart from '../components/charts/BarChart.vue'
import DoughnutChart from '../components/charts/DoughnutChart.vue'
import { useReports } from '../composables/useReports'

const { data, isLoading, errorMessage, fetchVehicleReports, fetchPeopleReports, fetchRevisionReports } =
  useReports()

const tabs = [
  { key: 'vehicles', label: 'Veículos', icon: Car },
  { key: 'people', label: 'Pessoas', icon: Users },
  { key: 'revisions', label: 'Revisões', icon: Wrench },
]
const activeTab = ref('vehicles')

const periodStart = ref('')
const periodEnd = ref('')

const hasAnyData = computed(
  () =>
    data.value.allVehicles.length ||
    data.value.allPeople.length ||
    data.value.revisionsByPeriod.length
)

const loadTab = (tab) => {
  if (tab === 'vehicles') fetchVehicleReports()
  if (tab === 'people') fetchPeopleReports()
  if (tab === 'revisions') fetchRevisionReports(periodStart.value, periodEnd.value)
}

onMounted(() => loadTab(activeTab.value))
watch(activeTab, (tab) => loadTab(tab))

const applyPeriodFilter = () => fetchRevisionReports(periodStart.value, periodEnd.value)

// ---- Derivações para os gráficos (Chart.js espera { labels, datasets }) ----

const vehiclesByGenderChart = computed(() => ({
  labels: data.value.vehiclesByGender.map((g) => (g.gender === 'M' ? 'Homens' : 'Mulheres')),
  datasets: [
    {
      data: data.value.vehiclesByGender.map((g) => g.count),
      backgroundColor: ['#6366f1', '#f472b6'],
      borderWidth: 0,
    },
  ],
}))

const genderWithMoreVehicles = computed(() => {
  const list = data.value.vehiclesByGender
  if (!list.length) return '—'
  const top = [...list].sort((a, b) => b.count - a.count)[0]
  return top.gender === 'M' ? 'Homens' : 'Mulheres'
})

const brandsRankingChart = computed(() => ({
  labels: data.value.brandsRanking.map((b) => b.brand),
  datasets: [
    {
      label: 'Veículos',
      data: data.value.brandsRanking.map((b) => b.count),
      backgroundColor: '#6366f1',
      borderRadius: 6,
    },
  ],
}))

const brandsByGenderChart = computed(() => ({
  labels: data.value.brandsByGender.map((b) => b.brand),
  datasets: [
    {
      label: 'Homens',
      data: data.value.brandsByGender.map((b) => b.male_count),
      backgroundColor: '#6366f1',
      borderRadius: 6,
    },
    {
      label: 'Mulheres',
      data: data.value.brandsByGender.map((b) => b.female_count),
      backgroundColor: '#f472b6',
      borderRadius: 6,
    },
  ],
}))

const peopleByGenderChart = computed(() => ({
  labels: data.value.peopleByGender.map((g) => (g.gender === 'M' ? 'Homens' : 'Mulheres')),
  datasets: [
    {
      data: data.value.peopleByGender.map((g) => g.count),
      backgroundColor: ['#6366f1', '#f472b6'],
      borderWidth: 0,
    },
  ],
}))

const avgAgeMale = computed(
  () => data.value.peopleByGender.find((g) => g.gender === 'M')?.avg_age ?? '—'
)
const avgAgeFemale = computed(
  () => data.value.peopleByGender.find((g) => g.gender === 'F')?.avg_age ?? '—'
)

const brandsRevisionChart = computed(() => ({
  labels: data.value.brandsRevisionRanking.map((b) => b.brand),
  datasets: [
    {
      label: 'Revisões',
      data: data.value.brandsRevisionRanking.map((b) => b.count),
      backgroundColor: '#22c55e',
      borderRadius: 6,
    },
  ],
}))

const peopleRevisionChart = computed(() => ({
  labels: data.value.peopleRevisionRanking.map((p) => p.person_name),
  datasets: [
    {
      label: 'Revisões',
      data: data.value.peopleRevisionRanking.map((p) => p.count),
      backgroundColor: '#f59e0b',
      borderRadius: 6,
    },
  ],
}))
</script>

<template>
  <AppShell title="Relatórios" subtitle="Consulte o histórico e os totais do sistema.">
    <!-- Abas -->
    <div class="mb-6 flex gap-2 border-b border-ink-100">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        class="flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors"
        :class="
          activeTab === tab.key
            ? 'border-brand-600 text-brand-600'
            : 'border-transparent text-ink-400 hover:text-ink-700'
        "
        @click="activeTab = tab.key"
      >
        <component :is="tab.icon" :size="16" />
        {{ tab.label }}
      </button>
    </div>

    <div v-if="isLoading" class="py-12 text-center text-sm text-ink-500">
      Carregando relatórios...
    </div>

    <div v-else-if="errorMessage" class="py-12 text-center text-sm text-red-600">
      {{ errorMessage }}
    </div>

    <EmptyState
      v-else-if="!hasAnyData"
      :icon="BarChart3"
      title="Sem dados suficientes"
      description="Os relatórios aparecerão aqui assim que houver revisões registradas."
    />

    <!-- VEÍCULOS -->
    <div v-else-if="activeTab === 'vehicles'" class="flex flex-col gap-6">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total de veículos" :value="data.allVehicles.length" :icon="Car" />
        <StatCard
          label="Maioria dos veículos pertence a"
          :value="genderWithMoreVehicles"
          :icon="Users"
          hint="Comparando homens x mulheres"
        />
        <StatCard
          label="Marca mais comum"
          :value="data.brandsRanking[0]?.brand ?? '—'"
          :icon="TrendingUp"
        />
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ReportPanel
          title="Veículos por gênero do proprietário"
          description="Quem possui mais veículos cadastrados no sistema."
        >
          <DoughnutChart :chart-data="vehiclesByGenderChart" />
        </ReportPanel>

        <ReportPanel
          title="Marcas mais cadastradas"
          description="Ranking de marcas por número de veículos."
        >
          <BarChart :chart-data="brandsRankingChart" horizontal />
        </ReportPanel>
      </div>

      <ReportPanel
        title="Marcas por gênero"
        description="Comparativo de marcas preferidas entre homens e mulheres."
      >
        <BarChart :chart-data="brandsByGenderChart" />
      </ReportPanel>

      <ReportPanel title="Todos os veículos por pessoa" description="Ordenado por nome do proprietário.">
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
    </div>

    <!-- PESSOAS -->
    <div v-else-if="activeTab === 'people'" class="flex flex-col gap-6">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total de pessoas" :value="data.allPeople.length" :icon="Users" />
        <StatCard label="Idade média — homens" :value="avgAgeMale" hint="anos" />
        <StatCard label="Idade média — mulheres" :value="avgAgeFemale" hint="anos" />
      </div>

      <ReportPanel
        title="Distribuição por gênero"
        description="Proporção de pessoas cadastradas por gênero."
      >
        <DoughnutChart :chart-data="peopleByGenderChart" />
      </ReportPanel>

      <ReportPanel title="Todas as pessoas">
        <ReportTable
          :columns="[
            { key: 'name', label: 'Nome' },
            { key: 'email', label: 'E-mail' },
            { key: 'phone', label: 'Telefone' },
          ]"
          :rows="data.allPeople"
        />
      </ReportPanel>
    </div>

    <!-- REVISÕES -->
    <div v-else class="flex flex-col gap-6">
      <div class="flex flex-wrap items-end gap-3 rounded-2xl border border-ink-100 bg-white p-4">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-ink-500">De</label>
          <input v-model="periodStart" type="date" class="rounded-lg border border-ink-200 px-3 py-1.5 text-sm" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-ink-500">Até</label>
          <input v-model="periodEnd" type="date" class="rounded-lg border border-ink-200 px-3 py-1.5 text-sm" />
        </div>
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-brand-500"
          @click="applyPeriodFilter"
        >
          <Calendar :size="14" />
          Filtrar
        </button>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ReportPanel title="Marcas com mais revisões" description="Quais marcas mais passam por revisão.">
          <BarChart :chart-data="brandsRevisionChart" horizontal />
        </ReportPanel>

        <ReportPanel title="Pessoas com mais revisões" description="Clientes mais frequentes.">
          <BarChart :chart-data="peopleRevisionChart" horizontal />
        </ReportPanel>
      </div>

      <ReportPanel
        title="Tempo médio entre revisões"
        description="Média de dias entre uma revisão e outra, por pessoa."
      >
        <ReportTable
          :columns="[
            { key: 'person_name', label: 'Pessoa' },
            { key: 'avg_days', label: 'Média (dias)' },
          ]"
          :rows="data.avgIntervalByPerson"
        />
      </ReportPanel>

      <ReportPanel
        title="Próximas revisões previstas"
        description="Estimativa baseada no tempo médio entre revisões de cada pessoa."
      >
        <ReportTable
          :columns="[
            { key: 'person_name', label: 'Pessoa' },
            { key: 'vehicle', label: 'Veículo' },
            { key: 'predicted_date', label: 'Data prevista' },
          ]"
          :rows="data.upcomingRevisions"
        />
      </ReportPanel>

      <ReportPanel title="Revisões no período selecionado">
        <ReportTable
          :columns="[
            { key: 'date', label: 'Data' },
            { key: 'person_name', label: 'Pessoa' },
            { key: 'vehicle', label: 'Veículo' },
            { key: 'description', label: 'Descrição' },
          ]"
          :rows="data.revisionsByPeriod"
        />
      </ReportPanel>
    </div>
  </AppShell>
</template>