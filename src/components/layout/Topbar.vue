<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
})
</script>

<template>
  <header class="flex items-start justify-between gap-4">
    <div>
      <h1 class="text-3xl font-extrabold tracking-tight text-ink-900">{{ title }}</h1>
      <p v-if="subtitle" class="mt-1 text-sm text-ink-500">{{ subtitle }}</p>
    </div>

    <div class="flex shrink-0 items-center gap-3">
      <slot name="actions" />
    </div>
  </header>
</template>
