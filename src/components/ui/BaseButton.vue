<script setup>
defineProps({
  type: { type: String, default: 'button' },
  variant: { type: String, default: 'primary' }, // 'primary' | 'ghost'
  block: { type: Boolean, default: false },
})

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors px-4 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed'

const variants = {
  primary: 'bg-ink-900 text-white hover:bg-ink-900/90',
  ghost: 'bg-transparent text-ink-700 hover:bg-surface',
  outline: 'bg-white text-ink-900 border border-surface-border hover:bg-surface',
}
</script>

<template>
  <button
    :type="type"
    :class="[base, variants[variant], block ? 'w-full' : '']"
  >
    <slot />
  </button>
</template>
