<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: String, required: true },
  icon: { type: [Object, Function], required: true },
  loading: { type: Boolean, default: false },
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
  </div>
</template>