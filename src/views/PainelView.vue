<script setup>
import { computed, ref, unref, watch } from 'vue'
import { useQuery, useQueries } from '@tanstack/vue-query'
import { Users, Car, Wrench, Wallet } from '@lucide/vue'
import AppShell from '../components/layout/AppShell.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import StatCard from '../components/dashboard/StatCard.vue'
import GettingStartedCard from '../components/dashboard/GettingStartedCard.vue'
import UpcomingRevisionsCard from '../components/dashboard/UpcomingRevisionsCard.vue'
// TODO: troque pelo nome/caminho real do arquivo do modal de revisões (documento 8)
import RevisionsModal from '../components/people/RevisionsModal.vue'
// usado como fallback quando a pessoa clica em "Cadastrar veículo" dentro do modal de revisões
import VehicleFormModal from '../components/people/VehicleFormModal.vue'
import { usePeople } from '../composables/usePeople'
import { useToast } from '../composables/useToast'
import { vehicleService } from '../services/vehicle.service'
import { revisionService } from '../services/revision.service'
// 🟢 NOVO — service do endpoint agregado (ver dashboard.service.js)
import { dashboardService } from '../services/dashboard.service'

const { people, isLoading: peopleLoading, errorMessage: peopleError, total: peopleTotal } = usePeople()
const toast = useToast()

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

watch(peopleError, (message) => {
  if (message) toast.error(message)
})

// 🟢 NOVO — uma única chamada que já traz people_count, vehicles_count,
// revisions_count e total_invested calculados no backend. Substitui o
// cálculo que antes era feito no frontend em cima de todas as listas.
const {
  data: summary,
  isLoading: summaryLoading,
  error: summaryError,
} = useQuery({
  queryKey: ['dashboard-summary'],
  queryFn: () => dashboardService.getSummary(),
})

watch(summaryError, (err) => {
  if (err) toast.error(err.response?.data?.message ?? 'Não foi possível carregar o resumo do painel.')
})

// 🟡 MANTIDO por enquanto — ainda necessário para o UpcomingRevisionsCard
// e para localizar o proprietário no openRevisionsModal. Não é mais usado
// para calcular os stat cards.
const {
  data: vehicles,
  isLoading: vehiclesLoading,
  error: vehiclesError,
} = useQuery({
  queryKey: ['vehicles'],
  queryFn: () => vehicleService.list(),
})

// 🟡 MANTIDO por enquanto — dispara uma query de revisões por veículo.
// TODO: assim que tivermos o UpcomingRevisionsCard.vue, trocar isso pelo
// endpoint /reports/revisions/upcoming (já existe no backend) e eliminar
// esse N+1 de vez.
const revisionQueries = useQueries({
  queries: computed(() =>
    (vehicles.value ?? []).map((vehicle) => ({
      queryKey: ['revisions', vehicle.id],
      queryFn: () => revisionService.listByVehicle(vehicle.id),
      enabled: !!vehicles.value,
    }))
  ),
})

const allRevisions = computed(() => revisionQueries.value.flatMap((q) => q.data ?? []))

const revisionsLoading = computed(
  () => vehiclesLoading.value || revisionQueries.value.some((q) => q.isLoading)
)

// isLoading agora reflete só o que os cards de resumo dependem (people +
// summary). Os outros carregamentos (veículos/revisões completos) seguem
// em paralelo, sem travar a exibição dos números do topo.
const isLoading = computed(() => peopleLoading.value || summaryLoading.value)

// 🟢 NOVO — stats vem direto do summary, sem reduce/loop no frontend.
const stats = computed(() => [
  {
    label: 'Pessoas',
    value: String(summary.value?.people_count ?? peopleTotal.value ?? 0),
    icon: Users,
    loading: summaryLoading.value,
  },
  {
    label: 'Veículos',
    value: String(summary.value?.vehicles_count ?? 0),
    icon: Car,
    loading: summaryLoading.value,
  },
  {
    label: 'Revisões',
    value: String(summary.value?.revisions_count ?? 0),
    icon: Wrench,
    loading: summaryLoading.value,
  },
  {
    label: 'Investido',
    value: formatCurrency(summary.value?.total_invested ?? 0),
    icon: Wallet,
    loading: summaryLoading.value,
  },
])

watch(vehiclesError, (err) => {
  if (err) toast.error(err.response?.data?.message ?? 'Não foi possível carregar os veículos.')
})

// Estado do modal de revisões (VehicleRevisionsModal exige "person" + aceita
// highlightVehicleId/highlightRevisionId opcionais)
const showRevisionsModal = ref(false)
const selectedPerson = ref(null)
const highlightVehicleId = ref(null)
// 🔴 AQUI — id da revisão que deve abrir já em modo edição (vem do clique
// no card de "Próximas revisões")
const highlightRevisionId = ref(null)

// Estado do modal de cadastro de veículo — aberto a partir do modal de
// revisões quando a pessoa ainda não tem nenhum veículo
const showVehicleFormModal = ref(false)

// 🔴 AQUI — agora aceita um segundo argumento opcional, o id da revisão que
// veio do clique na previsão do UpcomingRevisionsCard
const openRevisionsModal = (vehicle, revisionId = null) => {
  // unref cobre tanto o caso de "people" ser um ref quanto já vir desembrulhado
  const personList = unref(people) ?? []
  const person = personList.find((p) => p.id === vehicle.people_id)

  if (!person) {
    toast.error('Não foi possível localizar o proprietário deste veículo.')
    return
  }

  selectedPerson.value = person
  highlightVehicleId.value = vehicle.id
  highlightRevisionId.value = revisionId
  showRevisionsModal.value = true
}

const closeRevisionsModal = () => {
  showRevisionsModal.value = false
  selectedPerson.value = null
  highlightVehicleId.value = null
  highlightRevisionId.value = null
}

// Disparado pelo próprio VehicleRevisionsModal (@register-vehicle) quando a
// pessoa não tem veículo nenhum ainda e clica em "Cadastrar veículo"
const openVehicleFormFromRevisions = () => {
  showRevisionsModal.value = false
  showVehicleFormModal.value = true
}

const closeVehicleFormModal = () => {
  showVehicleFormModal.value = false
  selectedPerson.value = null
}
</script>

<template>
  <AppShell title="Painel" subtitle="Visão geral do sistema.">
    <template #actions>
      <router-link to="/people">
        <BaseButton variant="outline">Proprietários</BaseButton>
      </router-link>
      <router-link to="/relatorios">
        <BaseButton variant="primary">Ver relatórios</BaseButton>
      </router-link>
    </template>

    <section class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard v-for="stat in stats" :key="stat.label" v-bind="stat" />
    </section>

    <section class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <GettingStartedCard
        :has-people="(summary?.people_count ?? 0) > 0"
        :has-vehicles="(summary?.vehicles_count ?? 0) > 0"
        :has-revisions="(summary?.revisions_count ?? 0) > 0"
      />
      <UpcomingRevisionsCard
        :vehicles="vehicles ?? []"
        :people="people"
        :revisions="allRevisions"
        :is-loading="revisionsLoading"
        @edit-vehicle="openRevisionsModal"
      />
    </section>

    <RevisionsModal
      v-if="showRevisionsModal && selectedPerson"
      :person="selectedPerson"
      :highlight-vehicle-id="highlightVehicleId"
      :highlight-revision-id="highlightRevisionId"
      @close="closeRevisionsModal"
      @register-vehicle="openVehicleFormFromRevisions"
    />

    <VehicleFormModal
      v-if="showVehicleFormModal && selectedPerson"
      :person="selectedPerson"
      @close="closeVehicleFormModal"
    />
  </AppShell>
</template>