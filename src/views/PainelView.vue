<script setup>
import { computed, ref, unref, watch } from 'vue'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/vue-query'
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

const {
  data: summary,
  isLoading: summaryLoading,
  error: summaryError,
} = useQuery({
  queryKey: ['dashboard-summary'],
  queryFn: () => dashboardService.getSummary(),
  placeholderData: keepPreviousData,
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
// highlightVehicleId/highlightRevisionId/prefillDate/prefillKm opcionais)
const showRevisionsModal = ref(false)
const selectedPerson = ref(null)
const highlightVehicleId = ref(null)
const highlightRevisionId = ref(null)
// 🟢 NOVO — usados quando a previsão clicada NÃO é uma revisão agendada de
// verdade (é só uma data informada/estimada). Ver comentário detalhado em
// openRevisionsModal() logo abaixo.
const prefillDate = ref(null)
const prefillKm = ref(null)

// Estado do modal de cadastro de veículo — aberto a partir do modal de
// revisões quando a pessoa ainda não tem nenhum veículo
const showVehicleFormModal = ref(false)

// 🔧 CORRIGIDO — bug: clicar em QUALQUER previsão de "próxima revisão"
// (mesmo as de data informada/estimada, que ainda não são um registro de
// verdade) abria o modal já em modo EDIÇÃO da revisão ANTIGA que originou
// a previsão — confundindo o usuário, que via uma data futura na lista e
// caía editando um registro do passado ao clicar.
//
// Agora o evento emitido pelo UpcomingRevisionsCard já vem diferenciado:
// - revisionId preenchido -> é uma revisão futura REAL (agendada). Abre em
//   modo edição, como antes.
// - prefillDate preenchido (revisionId nulo) -> é só uma previsão. Abre o
//   RevisionsModal no modo de CRIAÇÃO, no veículo certo, já com a data (e
//   KM, se houver) prevista preenchidos — pra o usuário registrar a
//   revisão nova quando ela realmente acontecer.
const openRevisionsModal = ({ vehicleId, personId, revisionId = null, prefillDate: date = null, prefillKm: km = null }) => {
  const personList = unref(people) ?? []
  const person = personList.find((p) => p.id === personId)

  if (!person) {
    toast.error('Não foi possível localizar o proprietário deste veículo.')
    return
  }

  selectedPerson.value = person
  highlightVehicleId.value = vehicleId
  highlightRevisionId.value = revisionId
  prefillDate.value = date
  prefillKm.value = km
  showRevisionsModal.value = true
}

const closeRevisionsModal = () => {
  showRevisionsModal.value = false
  selectedPerson.value = null
  highlightVehicleId.value = null
  highlightRevisionId.value = null
  prefillDate.value = null
  prefillKm.value = null
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
    <template #actions>
      <BaseButton
        variant="secondary"
        :disabled="isRefreshing"
        class="flex items-center justify-center gap-2 cursor-pointer bg-brand-600 hover:bg-brand-500 text-white"
        @click="refreshPage"
      >
        <RefreshCw :size="16" :class="isRefreshing ? 'animate-spin' : ''" />
        {{ isRefreshing ? 'Atualizando...' : 'Atualizar' }}
      </BaseButton>
      <router-link to="/people">
        <BaseButton class="cursor-pointer" variant="outline">Proprietários</BaseButton>
      </router-link>
      <router-link to="/relatorios">
        <BaseButton class="cursor-pointer" variant="primary">Ver relatórios</BaseButton>
      </router-link>
    </template>

    <GettingStartedCard
      v-if="!isLoading && !hasPeople"
      :has-people="hasPeople"
      :has-vehicles="hasVehicles"
      :has-revisions="hasRevisions"
    />

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
      :prefill-date="prefillDate"
      :prefill-km="prefillKm"
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