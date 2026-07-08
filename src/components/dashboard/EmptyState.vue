<script setup>
defineProps({
  icon: { type: [Object, Function], required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
})
</script>

<template>
  <div
    class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-surface-border bg-white px-6 py-16 text-center"
  >
    <div class="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-500">
      <component :is="icon" :size="22" />
    </div>
    <h2 class="mt-4 text-base font-bold text-ink-900">{{ title }}</h2>
    <p class="mt-1 max-w-sm text-sm text-ink-500">{{ description }}</p>
    <slot />
  </div>
</template>