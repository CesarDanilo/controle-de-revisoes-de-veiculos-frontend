<script setup>
import { Users, Car, Wrench, Wallet } from '@lucide/vue'

const stats = [
  { label: 'peoples', icon: Users },
  { label: 'Veículos', icon: Car },
  { label: 'Revisões', icon: Wrench },
  { label: 'Investido', icon: Wallet },
]
</script>

<template>
  <div class="relative flex h-full flex-col justify-between overflow-hidden rounded-3xl bg-ink-900 p-10">
    <div
      class="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl"
    />
    <div
      class="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-brand-500/10 blur-3xl"
    />

    <div class="relative">
      <p class="text-xs font-semibold uppercase tracking-widest text-brand-400">Painel</p>
      <h2 class="mt-3 max-w-xs text-2xl font-bold leading-snug text-white">
        Cada revisão registrada, no lugar certo.
      </h2>
      <p class="mt-3 max-w-xs text-sm leading-relaxed text-white/60">
        Acompanhe peoples, veículos e o histórico de revisões em um só painel.
      </p>
    </div>

    <div class="relative grid grid-cols-2 gap-3">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
      >
        <component :is="stat.icon" :size="18" class="text-brand-400" />
        <p class="mt-3 text-xs font-medium uppercase tracking-wide text-white/50">
          {{ stat.label }}
        </p>
      </div>
    </div>
  </div>
</template>
