<script setup>
import { BarChart3 } from '@lucide/vue'
import AppShell from '../components/layout/AppShell.vue'
import EmptyState from '../components/dashboard/EmptyState.vue'
</script>

<template>
  <AppShell title="Relatórios" subtitle="Consulte o histórico e os totais do sistema.">
    <EmptyState
      :icon="BarChart3"
      title="Sem dados suficientes"
      description="Os relatórios aparecerão aqui assim que houver revisões registradas."
    />
  </AppShell>
</template>
