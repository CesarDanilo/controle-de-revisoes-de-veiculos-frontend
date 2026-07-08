<script setup>
defineProps({
  number: { type: Number, required: true },
})
</script>

<template>
  <li class="flex items-center gap-3">
    <span
      class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white"
    >
      {{ number }}
    </span>
    <p class="text-sm text-ink-700">
      <slot />
    </p>
  </li>
</template>
