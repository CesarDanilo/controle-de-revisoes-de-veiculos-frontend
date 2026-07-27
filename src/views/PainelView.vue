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

const { people, isLoading: peopleLoading, errorMessage: peopleError, total: peopleTotal } = usePeople()
const toast = useToast()

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

watch(peopleError, (message) => {
  if (message) toast.error(message)
})

const {
  data: vehicles,
  isLoading: vehiclesLoading,
  error: vehiclesError,
} = useQuery({
  queryKey: ['vehicles'],
  queryFn: () => vehicleService.list(),
})

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

const totalInvested = computed(() =>
  allRevisions.value.reduce((sum, revision) => sum + Number(revision.cost || 0), 0)
)

const isLoading = computed(
  () => peopleLoading.value || vehiclesLoading.value || revisionsLoading.value
)

const stats = computed(() => [
  {
    label: 'Pessoas',
    value: String(peopleTotal.value),
    icon: Users,
    loading: peopleLoading.value,
  },
  {
    label: 'Veículos',
    value: String((vehicles.value ?? []).length),
    icon: Car,
    loading: vehiclesLoading.value,
  },
  {
    label: 'Revisões',
    value: String(allRevisions.value.length),
    icon: Wrench,
    loading: revisionsLoading.value,
  },
  {
    label: 'Investido',
    value: formatCurrency(totalInvested.value),
    icon: Wallet,
    loading: revisionsLoading.value,
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
        :has-people="people.length > 0"
        :has-vehicles="(vehicles ?? []).length > 0"
        :has-revisions="allRevisions.length > 0"
      />
      <UpcomingRevisionsCard
        :vehicles="vehicles ?? []"
        :people="people"
        :revisions="allRevisions"
        :is-loading="isLoading"
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