<script setup>
defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
})
</script>

<template>
  <div class="rounded-2xl border border-ink-100 bg-white p-5">
    <h3 class="text-sm font-semibold text-ink-900">{{ title }}</h3>
    <p v-if="description" class="mt-0.5 text-xs text-ink-400">{{ description }}</p>
    <div class="mt-4">
      <slot />
    </div>
  </div>
</template>