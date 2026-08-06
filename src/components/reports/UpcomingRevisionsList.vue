<script setup>
import { AlertTriangle, Calendar, Clock, Car, ChevronRight } from '@lucide/vue'

defineProps({
  // [{ person_id, vehicle_id, revision_id, person_name, vehicle, predicted_date_label, status, origin_label, predictions_count }]
  // status: 'overdue' | 'today' | 'soon' | 'normal'
  // predictions_count: quantas revisões pendentes esse veículo tem no total
  items: { type: Array, required: true },
})

// 🔴 AQUI — clique/Enter/Espaço no item: se predictions_count > 1, o
// UpcomingRevisionsPanel abre primeiro um modal de escolha; se for só 1,
// vai direto pro modal de revisões da pessoa (ver UpcomingRevisionsPanel.vue)
const emit = defineEmits(['select'])

const STATUS_STYLE = {
  overdue: { badge: 'bg-red-50 text-red-700', icon: AlertTriangle, label: 'Atrasada' },
  today: { badge: 'bg-brand-50 text-brand-700', icon: Calendar, label: 'Hoje' },
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
          <!-- 🟢 NOVO — badge deixando explícito que existe mais de uma
               revisão pendente pra esse veículo, evitando que o usuário
               interprete a data mostrada como a única pendência. -->
          <span
            v-if="item.predictions_count > 1"
            class="mt-1 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"
          >
            {{ item.predictions_count }} previstas
          </span>
        </div>

        <ChevronRight
          :size="16"
          class="shrink-0 text-ink-300 opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden="true"
        />
      </div>
    </li>
  </ul>
</template>