<script setup>
import { ArrowUpRight } from '@lucide/vue'

defineProps({
  label: { type: String, required: true },
  value: { type: String, required: true },
  icon: { type: [Object, Function], required: true },
  loading: { type: Boolean, default: false },
  to: { type: String, default: null },
})
</script>

<template>
  <div class="rounded-2xl border border-ink-100 bg-white p-5">
    <div class="flex items-center justify-between">
      <p class="text-xs font-semibold uppercase tracking-wide text-ink-500">{{ label }}</p>
      <component :is="icon" :size="18" :class="loading ? 'text-ink-300' : 'text-brand-500'" />
    </div>

    <div class="mt-3 h-9 flex items-center">
      <div
        v-if="loading"
        class="h-6 w-20 animate-pulse rounded-md bg-ink-100"
        role="status"
        aria-label="Carregando"
      />
      <p v-else class="text-3xl font-extrabold tracking-tight text-ink-900">{{ value }}</p>
    </div>

    <!-- 🟢 NOVO — mesmo padrão do link "Ver relatórios" do UpcomingRevisionsCard -->
    <router-link
      v-if="to"
      :to="to"
      class="mt-4 flex w-fit items-center gap-1 rounded-lg text-xs font-medium text-brand-600 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      Ver {{ label }}
      <ArrowUpRight :size="12" />
    </router-link>
  </div>
</template>