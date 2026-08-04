<script setup>
import { computed, ref, unref, watch } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { Users, Car, Wrench, Wallet, RefreshCw } from '@lucide/vue'
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
const { people, isLoading: peopleLoading, errorMessage: peopleError, fetchPeople } = usePeople()
const toast = useToast()
const queryClient = useQueryClient()

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

// 🟢 NOVO — botão "Atualizar" manual. O problema real: `dashboard-summary`
// e o que o UpcomingRevisionsCard busca internamente ficam em cache do
// Vue Query (não revalidam sozinhos ao trocar de módulo), e `usePeople`
// busca a lista uma vez só via chamada direta (não é uma query cacheada
// pelo Vue Query) — cadastrar uma pessoa em outra tela não invalida nada
// disso automaticamente. Por isso o reload manual "resolvia" antes.
//
// invalidateQueries() sem filtro invalida TODAS as queries ativas do Vue
// Query no momento (dashboard-summary + a query interna do
// UpcomingRevisionsCard, sejam quais forem suas keys), forçando o refetch
// de tudo que estiver montado na tela. fetchPeople(1) cobre a parte que
// não passa pelo Vue Query.
const isRefreshing = ref(false)

const refreshPage = async () => {
  if (isRefreshing.value) return
  isRefreshing.value = true
  try {
    await Promise.all([
      queryClient.invalidateQueries(),
      fetchPeople(1),
    ])
    toast.success('Dados atualizados!')
  } catch (error) {
    toast.error('Não foi possível atualizar os dados.')
  } finally {
    isRefreshing.value = false
  }
}

// 🟢 NOVO — critério pra decidir entre "onboarding" ou "painel normal": o
// básico pra sair do estado zerado é ter pelo menos UM proprietário
// cadastrado (é o primeiro passo do fluxo people → veículo → revisão).
// Enquanto isso não existir, o painel de KPIs/próximas revisões não teria
// números relevantes pra mostrar mesmo, então priorizamos o guia de
// onboarding em vez de cards zerados.
const hasPeople = computed(() => (summary.value?.people_count ?? 0) > 0)
const hasVehicles = computed(() => (summary.value?.vehicles_count ?? 0) > 0)
const hasRevisions = computed(() => (summary.value?.revisions_count ?? 0) > 0)

// 🔧 CORRIGIDO — "Revisões" antes apontava pra "#proximas-revisoes" (painel
// de alertas lá em cima), mas esse card mostra a CONTAGEM TOTAL de
// revisões, então o destino correto é a tabela detalhada de revisões
// (aba "Revisões", "#aba-revisoes"), igual já acontecia com Veículos/Pessoas.
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
    to: '/relatorios#aba-revisoes',
  },
  {
    label: 'Faturamento',
    value: formatCurrency(summary.value?.total_invested ?? 0),
    icon: Wallet,
    loading: summaryLoading.value,
    to: '/relatorios',
  },
])

// Estado do modal de revisões (RevisionsModal exige "person" + aceita
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

// Disparado pelo próprio RevisionsModal (@register-vehicle) quando a
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
    <!-- 🔧 CORRIGIDO — GettingStartedCard estava sendo renderizado dentro do
         slot #actions (o slot de botões ao lado do título no AppShell), o
         que não fazia sentido pra um card grande de onboarding. Removido
         daqui; agora vive no corpo da página, condicionado ao estado dos
         dados (ver abaixo). -->
    <template #actions>
      <!-- 🟢 NOVO — botão de atualizar manual, sem reload de página -->
      <BaseButton
        variant="outline"
        :disabled="isRefreshing"
        class="flex items-center justify-center gap-2"
        @click="refreshPage"
      >
        <RefreshCw :size="16" :class="isRefreshing ? 'animate-spin' : ''" />
        {{ isRefreshing ? 'Atualizando...' : 'Atualizar' }}
      </BaseButton>
      <router-link to="/people">
        <BaseButton variant="outline">Proprietários</BaseButton>
      </router-link>
      <router-link to="/relatorios">
        <BaseButton variant="primary">Ver relatórios</BaseButton>
      </router-link>
    </template>

    <!-- 🟢 NOVO — ONBOARDING: exibido só enquanto não houver nenhum
         proprietário cadastrado (o básico pro fluxo pessoa → veículo →
         revisão fazer sentido). Evita mostrar KPIs zerados e "Próximas
         revisões" vazio pra quem está chegando agora no sistema; o card
         guia exatamente o primeiro passo (cadastrar um proprietário).
         Durante o carregamento inicial (isLoading), não decidimos ainda —
         evita um "flash" trocando de onboarding pra painel normal assim
         que os dados chegam. -->
    <GettingStartedCard
      v-if="!isLoading && !hasPeople"
      :has-people="hasPeople"
      :has-vehicles="hasVehicles"
      :has-revisions="hasRevisions"
    />

    <!-- 🟢 NOVO — PAINEL NORMAL: assim que existir pelo menos um
         proprietário, o onboarding some e entram os KPIs + próximas
         revisões, que synchronize com dados reais. Durante o carregamento
         inicial também cai aqui, pra manter os esqueletos de loading dos
         StatCards em vez de piscar o onboarding antes da resposta chegar. -->
    <template v-else>
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

      <UpcomingRevisionsCard @edit-vehicle="openRevisionsModal" />
    </template>

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