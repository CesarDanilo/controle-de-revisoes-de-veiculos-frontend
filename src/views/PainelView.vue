<script setup>
import { computed, onMounted, ref } from 'vue'
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

const vehicles = ref([])
const allRevisions = ref([])
const isLoading = ref(true)

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const totalInvested = computed(() =>
  allRevisions.value.reduce((sum, revision) => sum + Number(revision.cost || 0), 0)
)

const stats = computed(() => [
  { label: 'Pessoas', value: String(people.value.length), icon: Users },
  { label: 'Veículos', value: String(vehicles.value.length), icon: Car },
  { label: 'Revisões', value: String(allRevisions.value.length), icon: Wrench },
  { label: 'Investido', value: formatCurrency(totalInvested.value), icon: Wallet },
])

const loadDashboard = async () => {
  isLoading.value = true
  try {
    await fetchPeople()
    vehicles.value = await vehicleService.list()

    const results = await Promise.all(
      vehicles.value.map((vehicle) => revisionService.listByVehicle(vehicle.id))
    )
    allRevisions.value = results.flat()
  } catch (error) {
    const message =
      error.response?.data?.message ?? 'Não foi possível carregar os dados do painel.'
    toast.error(message)
  } finally {
    isLoading.value = false
  }
}

onMounted(loadDashboard)
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

    <section v-if="isLoading" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div
        v-for="n in 4"
        :key="n"
        class="h-24 animate-pulse rounded-2xl border border-ink-100 bg-ink-50"
      />
    </section>

    <section v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard v-for="stat in stats" :key="stat.label" v-bind="stat" />
    </section>

    <section class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <GettingStartedCard
        :has-people="people.length > 0"
        :has-vehicles="vehicles.length > 0"
        :has-revisions="allRevisions.length > 0"
      />
      <UpcomingRevisionsCard
        :vehicles="vehicles"
        :people="people"
        :revisions="allRevisions"
        :is-loading="isLoading"
      />
    </section>
  </AppShell>
</template>