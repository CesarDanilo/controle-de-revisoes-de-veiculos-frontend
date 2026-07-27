<script setup>
import { computed, ref } from 'vue'
import { useQuery, useQueries } from '@tanstack/vue-query'
import { Users, Car, Wrench, Wallet } from '@lucide/vue'
import AppShell from '../components/layout/AppShell.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import StatCard from '../components/dashboard/StatCard.vue'
import GettingStartedCard from '../components/dashboard/GettingStartedCard.vue'
import UpcomingRevisionsCard from '../components/dashboard/UpcomingRevisionsCard.vue'
import { usePeople } from '../composables/usePeople'
import { useToast } from '../composables/useToast'
import { vehicleService } from '../services/vehicle.service'
import { revisionService } from '../services/revision.service'

const { people, fetchPeople } = usePeople()
const toast = useToast()

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// people continua vindo do seu composable original. Como ele não expõe um
// estado de loading próprio, controlamos um ref local só pra isso.
const peopleLoading = ref(true)
fetchPeople()
  .catch((error) => {
    toast.error(error.response?.data?.message ?? 'Não foi possível carregar as pessoas.')
  })
  .finally(() => {
    peopleLoading.value = false
  })

// Vehicles: cache do Vue Query
const {
  data: vehicles,
  isLoading: vehiclesLoading,
  error: vehiclesError,
} = useQuery({
  queryKey: ['vehicles'],
  queryFn: () => vehicleService.list(),
})

// Revisions: uma query por veículo, só roda depois que "vehicles" chegar
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

// Loading das revisões: true enquanto vehicles ainda não chegou OU
// enquanto qualquer query de revisão individual ainda está carregando.
const revisionsLoading = computed(
  () => vehiclesLoading.value || revisionQueries.value.some((q) => q.isLoading)
)

const totalInvested = computed(() =>
  allRevisions.value.reduce((sum, revision) => sum + Number(revision.cost || 0), 0)
)

// Loading geral, usado só pros cards de baixo (GettingStarted / UpcomingRevisions)
const isLoading = computed(
  () => peopleLoading.value || vehiclesLoading.value || revisionsLoading.value
)

const stats = computed(() => [
  {
    label: 'Pessoas',
    value: String(people.value.length),
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
    // "Investido" depende das revisões, então usa o mesmo loading delas
    loading: revisionsLoading.value,
  },
])

if (vehiclesError.value) {
  toast.error(vehiclesError.value.response?.data?.message ?? 'Não foi possível carregar os veículos.')
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
      />
    </section>
  </AppShell>
</template>