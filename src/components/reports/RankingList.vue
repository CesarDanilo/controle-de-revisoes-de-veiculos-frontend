<script setup>
import { computed, ref } from 'vue'
import { ChevronDown } from '@lucide/vue'

const props = defineProps({
  items: { type: Array, required: true }, // [{ label, value }]
  accentClass: { type: String, default: 'bg-brand-500' }, // cor da mini-barra
  valueSuffix: { type: String, default: '' },
  emptyLabel: { type: String, default: 'Nenhum dado disponível.' },
  initialVisible: { type: Number, default: 5 },
  maxVisible: { type: Number, default: 10 },
})

const visibleCount = ref(props.initialVisible)

const sorted = computed(() => [...props.items].sort((a, b) => b.value - a.value))
const maxValue = computed(() => Math.max(...sorted.value.map((i) => i.value), 1))
const displayed = computed(() => sorted.value.slice(0, visibleCount.value))
const canExpand = computed(
  () => sorted.value.length > visibleCount.value && visibleCount.value < props.maxVisible
)

const expand = () => {
  visibleCount.value = Math.min(props.maxVisible, sorted.value.length)
}

// Top 3 ganham selo de destaque — reforça hierarquia sem depender só de cor
const RANK_BADGE = [
  'bg-amber-100 text-amber-700',
  'bg-ink-200 text-ink-600',
  'bg-orange-100 text-orange-700',
]
</script>

<template>
  <div v-if="!sorted.length" class="py-8 text-center text-sm text-ink-400">
    {{ emptyLabel }}
  </div>

  <ol v-else class="flex flex-col gap-3">
    <li v-for="(item, index) in displayed" :key="item.label" class="flex items-center gap-3">
      <span
        class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
        :class="RANK_BADGE[index] || 'bg-ink-50 text-ink-400'"
        aria-hidden="true"
      >
        {{ index + 1 }}
      </span>

      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <div class="flex items-baseline justify-between gap-2">
          <span class="truncate text-sm font-medium text-ink-800">{{ item.label }}</span>
          <span class="shrink-0 text-sm font-semibold tabular-nums text-ink-900">
            {{ item.value }}{{ valueSuffix }}
          </span>
        </div>
        <div class="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
          <div
            class="h-full rounded-full transition-all"
            :class="accentClass"
            :style="{ width: `${(item.value / maxValue) * 100}%` }"
          ></div>
        </div>
      </div>
    </li>
  </ol>

  <button
    v-if="canExpand"
    type="button"
    class="mt-4 flex items-center gap-1 self-start text-xs font-medium text-brand-600 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 rounded"
    @click="expand"
  >
    Ver Top {{ maxVisible }}
    <ChevronDown :size="14" />
  </button>
</template>