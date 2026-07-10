<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: String, required: true },
  icon: { type: [Object, Function], required: true },
})
</script>

<template>
  <div class="rounded-2xl border border-ink-100 bg-white p-5">
    <div class="flex items-center justify-between">
      <p class="text-xs font-semibold uppercase tracking-wide text-ink-500">{{ label }}</p>
      <component :is="icon" :size="18" class="text-brand-500" />
    </div>
    <p class="mt-3 text-3xl font-extrabold tracking-tight text-ink-900">{{ value }}</p>
  </div>
</template>
