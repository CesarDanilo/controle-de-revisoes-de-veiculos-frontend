<script setup>
import { computed } from 'vue'
import { TrendingUp, TrendingDown } from '@lucide/vue'

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  icon: { type: [Object, Function], required: true },
  hint: { type: String, default: '' },
  accent: { type: String, default: 'brand' },
  trend: { type: Number, default: null },
  loading: { type: Boolean, default: false },
})

const ACCENT_ICON_BG = {
  brand: 'bg-brand-50 text-brand-600',
  success: 'bg-green-50 text-green-600',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-red-50 text-red-600',
  neutral: 'bg-ink-100 text-ink-500',
}

// Ajusta o tamanho da fonte conforme o comprimento do valor, pra caber
// sem cortar. Valores curtos ("42") ficam grandes e chamam atenção;
// valores longos ("R$ 12.345,67") encolhem o suficiente pra caber
// numa linha só no card.
const valueFontClass = computed(() => {
  const length = String(props.value).length
  if (length <= 6) return 'text-2xl md:text-3xl'
  if (length <= 10) return 'text-xl md:text-2xl'
  if (length <= 14) return 'text-lg md:text-xl'
  return 'text-base md:text-lg'
})
</script>

<template>
  <div
    class="flex min-w-0 flex-col gap-3 overflow-hidden rounded-2xl border border-ink-100 bg-white p-5 shadow-sm shadow-ink-900/[0.02]"
  >
    <div class="flex items-start justify-between gap-2">
      <span class="truncate text-xs font-medium uppercase tracking-wide text-ink-400">
        {{ label }}
      </span>
      <span
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        :class="ACCENT_ICON_BG[accent] || ACCENT_ICON_BG.brand"
        aria-hidden="true"
      >
        <component :is="icon" :size="16" />
      </span>
    </div>

    <div v-if="loading" class="flex flex-col gap-2" aria-hidden="true">
      <div class="h-7 w-20 animate-pulse rounded-md bg-ink-100"></div>
      <div class="h-3 w-24 animate-pulse rounded-md bg-ink-100"></div>
    </div>

    <!-- Valor sempre visível por completo: sem truncate, sem depender de
         hover. break-words + leading-tight garantem que, mesmo no pior
         caso, o texto quebra em 2 linhas em vez de sumir. -->
    <div v-else class="flex min-w-0 flex-col gap-1">
      <span
        class="break-words font-semibold leading-tight tabular-nums text-ink-900"
        :class="valueFontClass"
      >
        {{ value }}
      </span>

      <div class="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
        <span
          v-if="trend !== null"
          class="flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium"
          :class="trend >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'"
        >
          <component :is="trend >= 0 ? TrendingUp : TrendingDown" :size="12" aria-hidden="true" />
          {{ Math.abs(trend) }}%
        </span>
        <span v-if="hint" class="text-ink-400">{{ hint }}</span>
      </div>
    </div>
  </div>
</template>