<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  icon: { type: [Object, Function], default: null },
  hint: { type: String, default: '' },
})
</script>

<template>
  <div class="flex items-start justify-between rounded-2xl border border-ink-100 bg-white p-5">
    <div>
      <p class="text-sm text-ink-500">{{ label }}</p>
      <p class="mt-1 text-2xl font-semibold text-ink-900">{{ value }}</p>
      <p v-if="hint" class="mt-1 text-xs text-ink-400">{{ hint }}</p>
    </div>
    <div v-if="icon" class="rounded-xl bg-brand-50 p-2.5 text-brand-600">
      <component :is="icon" :size="20" />
    </div>
  </div>
</template>