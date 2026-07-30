<script setup>
import { AlertTriangle, Clock, Car, ChevronRight } from '@lucide/vue'

defineProps({
  // [{ person_id, vehicle_id, revision_id, person_name, vehicle, predicted_date_label, status, origin_label }]
  // status: 'overdue' | 'soon' | 'normal'
  items: { type: Array, required: true },
})

// 🔴 AQUI — clique/Enter/Espaço no item abre o modal de revisões da pessoa,
// já destacando a revisão específica (ver UpcomingRevisionsPanel.vue)
const emit = defineEmits(['select'])

// 🔧 CORRIGIDO — badges agora seguem a mesma paleta usada em outros
// indicadores de status do app (ex: banner de erro em ReportsView.vue usa
// red-50/text-red-700; KPI "warning" usa amber). "Atrasada" e "Esta
// semana" usam essas mesmas cores, em vez de tons soltos.
const STATUS_STYLE = {
  overdue: { badge: 'bg-red-50 text-red-700', icon: AlertTriangle, label: 'Atrasada' },
  soon: { badge: 'bg-amber-50 text-amber-700', icon: Clock, label: 'Esta semana' },
}
</script>

<template>
  <div v-if="!items.length" class="py-8 text-center text-sm text-ink-400">
    Nenhuma revisão prevista no momento.
  </div>

  <ul v-else class="flex flex-col">
    <li
      v-for="(item, index) in items"
      :key="item.revision_id ?? `${item.person_name}-${item.vehicle}-${index}`"
      class="group flex cursor-pointer hover:bg-amber-50/50 items-center justify-between gap-3 rounded-lg px-2 py-3 -mx-2 transition-colors first:pt-0 last:pb-0 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset"
      tabindex="0"
      role="button"
      :aria-label="`Ver revisões de ${item.person_name} — ${item.vehicle}`"
      @click="emit('select', item)"
      @keydown.enter="emit('select', item)"
      @keydown.space.prevent="emit('select', item)"
    >

      <div class="flex min-w-0 items-center gap-3">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Car :size="15" aria-hidden="true" />
        </span>
        <div class="flex min-w-0 flex-col">
          <span class="truncate text-sm font-medium text-ink-900">{{ item.person_name }}</span>
          <span class="truncate text-xs text-ink-500">{{ item.vehicle }}</span>
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <span
          v-if="STATUS_STYLE[item.status]"
          class="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
          :class="STATUS_STYLE[item.status].badge"
        >
          <component :is="STATUS_STYLE[item.status].icon" :size="11" aria-hidden="true" />
          {{ STATUS_STYLE[item.status].label }}
        </span>

        <div class="flex flex-col items-end">
          <span class="text-xs font-semibold tabular-nums text-ink-800">
            {{ item.predicted_date_label }}
          </span>
          <span
            class="text-[10px] text-ink-400"
            :title="item.origin_label === 'Estimado' ? 'Calculado com base no histórico do veículo' : 'Informado no cadastro'"
          >
            {{ item.origin_label }}
          </span>
        </div>

        <!-- 🟢 NOVO — affordance de navegação: chevron sutil que aparece e
             desliza no hover/focus, sinalizando "clique leva a outro
             lugar" (o RevisionsModal), em vez do item parecer só uma
             linha estática. -->
        <ChevronRight
          :size="16"
          class="shrink-0 text-ink-300 opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden="true"
        />
      </div>
    </li>
  </ul>
</template>