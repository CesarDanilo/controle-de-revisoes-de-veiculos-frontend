<script setup>
import { computed, ref, unref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
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
import { dashboardService } from '../services/dashboard.service'

// 🟡 MANTIDO — ainda precisamos da lista de pessoas pra localizar o
// proprietário quando o usuário clica num veículo (RevisionsModal exige o
// objeto "person" completo, não só o id).
const { people, isLoading: peopleLoading, errorMessage: peopleError } = usePeople()
const toast = useToast()

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

watch(peopleError, (message) => {
  if (message) toast.error(message)
})

// 🟢 NOVO — os 4 cards do topo vêm de uma única chamada agregada,
// calculada no backend (COUNT/SUM), sem trafegar listas completas.
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

// 🟢 ALTERADO — não busca mais "vehicles" nem faz o N+1 de revisões aqui.
// O UpcomingRevisionsCard agora busca seus próprios dados (endpoint
// /reports/revisions/upcoming). O GettingStartedCard usa as contagens do
// summary em vez de listas completas.
const isLoading = computed(() => peopleLoading.value || summaryLoading.value)

// 🟢 ALTERADO — cada card agora só leva um link interno "Ver relatório"
// (renderizado pelo próprio StatCard via prop "to"), não o card inteiro
// clicável. As âncoras "#aba-*" trocam a aba de detalhe ativa em
// ReportsView.vue antes de rolar (ver TAB_HASH_MAP lá); "#proximas-revisoes"
// e "#secao-financeiro" são seções fixas, mesmo padrão de sempre.
const stats = computed(() => [
  {
    label: 'Pessoas',
    value: String(summary.value?.people_count ?? 0),
    icon: Users,
    loading: summaryLoading.value,
    to: '/relatorios#aba-pessoas',
  },
  {
    label: 'Veículos',
    value: String(summary.value?.vehicles_count ?? 0),
    icon: Car,
    loading: summaryLoading.value,
    to: '/relatorios#aba-veiculos',
  },
  {
    label: 'Revisões',
    value: String(summary.value?.revisions_count ?? 0),
    icon: Wrench,
    loading: summaryLoading.value,
    to: '/relatorios#proximas-revisoes',
  },
  {
    label: 'Investido',
    value: formatCurrency(summary.value?.total_invested ?? 0),
    icon: Wallet,
    loading: summaryLoading.value,
    to: '/relatorios#secao-financeiro',
  },
])

// Estado do modal de revisões (VehicleRevisionsModal exige "person" + aceita
// highlightVehicleId/highlightRevisionId opcionais)
const showRevisionsModal = ref(false)
const selectedPerson = ref(null)
const highlightVehicleId = ref(null)
const highlightRevisionId = ref(null)

// Estado do modal de cadastro de veículo — aberto a partir do modal de
// revisões quando a pessoa ainda não tem nenhum veículo
const showVehicleFormModal = ref(false)

// 🟡 ALTERADO — antes recebia o objeto "vehicle" inteiro (vindo da lista
// completa que buscávamos aqui). Agora o UpcomingRevisionsCard já busca
// seus próprios dados e emite só os IDs necessários (vehicleId, personId,
// revisionId). A pessoa é localizada na lista de "people" (que já
// carregamos de qualquer forma, via usePeople, pra outras partes do app).
const openRevisionsModal = ({ vehicleId, personId, revisionId = null }) => {
  const personList = unref(people) ?? []
  const person = personList.find((p) => p.id === personId)

  if (!person) {
    toast.error('Não foi possível localizar o proprietário deste veículo.')
    return
  }

  selectedPerson.value = person
  highlightVehicleId.value = vehicleId
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
      <StatCard
        v-for="stat in stats"
        :key="stat.label"
        :label="stat.label"
        :value="stat.value"
        :icon="stat.icon"
        :loading="stat.loading"
        :to="stat.to"
      />
    </section>

    <section class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <GettingStartedCard
        :has-people="(summary?.people_count ?? 0) > 0"
        :has-vehicles="(summary?.vehicles_count ?? 0) > 0"
        :has-revisions="(summary?.revisions_count ?? 0) > 0"
      />
      <UpcomingRevisionsCard @edit-vehicle="openRevisionsModal" />
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