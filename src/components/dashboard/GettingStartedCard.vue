<script setup>
import StepItem from './StepItem.vue'
</script>

<template>
  <div class="rounded-2xl border border-surface-border bg-white p-6">
    <h2 class="text-base font-bold text-ink-900">Comece por aqui</h2>
    <p class="mt-1 text-sm text-ink-500">Fluxo recomendado: people → veículo → revisão.</p>

    <ol class="mt-5 flex flex-col gap-4">
      <StepItem :number="1">
        Cadastre um
        <router-link to="/people" class="font-medium text-ink-900 underline underline-offset-2">
          Proprietário
        </router-link>.
      </StepItem>
      <StepItem :number="2">Adicione os veículos dele.</StepItem>
      <StepItem :number="3">Registre as revisões de cada veículo.</StepItem>
      <StepItem :number="4">
        Consulte os
        <router-link to="/relatorios" class="font-medium text-ink-900 underline underline-offset-2">
          relatórios
        </router-link>.
      </StepItem>
    </ol>
  </div>
</template>
