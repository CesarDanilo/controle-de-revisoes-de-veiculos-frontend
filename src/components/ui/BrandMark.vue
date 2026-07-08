<script setup>
import { History } from '@lucide/vue'

defineProps({
  size: {
    type: String,
    default: 'md', // 'sm' | 'md' | 'lg'
  },
})

const wrapSizes = {
  sm: 'h-8 w-8 rounded-lg',
  md: 'h-11 w-11 rounded-xl',
  lg: 'h-14 w-14 rounded-2xl',
}

const iconSizes = {
  sm: 16,
  md: 20,
  lg: 26,
}
</script>

<template>
  <div class="flex items-center gap-3">
    <div
      :class="wrapSizes[size]"
      class="flex shrink-0 items-center justify-center bg-brand-500 text-white shadow-sm shadow-brand-500/30"
    >
      <History :size="iconSizes[size]" :stroke-width="2.25" />
    </div>
    <div class="leading-tight">
      <p class="font-extrabold tracking-tight text-ink-900" :class="size === 'lg' ? 'text-xl' : 'text-base'">
        Revisar
      </p>
      <p class="text-xs text-ink-500">Controle de revisões</p>
    </div>
  </div>
</template>
