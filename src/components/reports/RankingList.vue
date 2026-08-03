<script setup>
import { computed } from 'vue'

const props = defineProps({
  items: { type: Array, required: true }, // [{ label, value }]
  accentClass: { type: String, default: 'bg-brand-500' }, // cor da mini-barra
  valueSuffix: { type: String, default: '' },
  emptyLabel: { type: String, default: 'Nenhum dado disponível.' },
  // altura do container com scroll (em px) — a partir daqui a lista rola
  maxHeight: { type: Number, default: 280 },
})

// 🔧 CORRIGIDO — removida a lógica de "carregar em lotes ao rolar"
// (visibleCount/batchSize/handleScroll). Como `items` já chega inteiro via
// prop (não é paginação de API), ela só travava: com poucos itens
// (ex.: 5) o conteúdo nem preenchia os `maxHeight` px do container, então
// nunca aparecia barra de rolagem para disparar o carregamento do próximo
// lote — na prática o usuário nunca via além do "Top 5". Agora a lista
// inteira (`sorted`) é renderizada de uma vez dentro do container com
// `overflow-y-auto`; o scroll nativo do navegador mostra o resto.
const sorted = computed(() => [...props.items].sort((a, b) => b.value - a.value))
const maxValue = computed(() => Math.max(...sorted.value.map((i) => i.value), 1))

// Top 3 ganham selo de destaque — reforça hierarquia sem depender só de cor
const RANK_BADGE = [
  'bg-orange-100 text-orange-700',
  'bg-orange-100 text-orange-700',
  'bg-orange-100 text-orange-700',
]
</script>

<template>
  <div v-if="!sorted.length" class="py-8 text-center text-sm text-ink-400">
    {{ emptyLabel }}
  </div>

  <div
    v-else
    class="custom-scrollbar overflow-y-auto pr-1"
    :style="{ maxHeight: `${maxHeight}px` }"
  >
    <ol class="flex flex-col gap-3">
      <li v-for="(item, index) in sorted" :key="item.label" class="flex items-center gap-3">
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
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #d1d1d6;
  border-radius: 999px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: #b5b5bd;
}
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: #d1d1d6 transparent;
}
</style>