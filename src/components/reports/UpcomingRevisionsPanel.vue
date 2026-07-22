<script setup>
import { AlertTriangle, Clock, Car } from '@lucide/vue'

defineProps({
  // [{ person_name, vehicle, predicted_date_label, status, origin_label }]
  // status: 'overdue' | 'soon' | 'normal'
  items: { type: Array, required: true },
})

const STATUS_STYLE = {
  overdue: { badge: 'bg-red-50 text-red-700', icon: AlertTriangle, label: 'Atrasada' },
  soon: { badge: 'bg-amber-50 text-amber-700', icon: Clock, label: 'Esta semana' },
}
</script>

<template>
  <div v-if="!items.length" class="py-8 text-center text-sm text-ink-400">
    Nenhuma revisão prevista no momento.
  </div>

  <ul v-else class="flex flex-col divide-y divide-ink-100">
    <li
      v-for="(item, index) in items"
      :key="`${item.person_name}-${item.vehicle}-${index}`"
      class="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
    >
      <div class="flex items-center gap-2.5">
        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-50 text-ink-400">
          <Car :size="14" aria-hidden="true" />
        </span>
        <div class="flex flex-col">
          <span class="text-sm font-medium text-ink-800">{{ item.person_name }}</span>
          <span class="text-xs text-ink-400">{{ item.vehicle }}</span>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <span
          v-if="STATUS_STYLE[item.status]"
          class="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
          :class="STATUS_STYLE[item.status].badge"
        >
          <component :is="STATUS_STYLE[item.status].icon" :size="11" aria-hidden="true" />
          {{ STATUS_STYLE[item.status].label }}
        </span>
        <span class="text-xs font-medium tabular-nums text-ink-600">
          {{ item.predicted_date_label }}
        </span>
        <span
          class="rounded-full bg-ink-50 px-1.5 py-0.5 text-[10px] font-medium text-ink-400"
          :title="item.origin_label === 'Estimado' ? 'Calculado com base no histórico do veículo' : 'Informado no cadastro'"
        >
          {{ item.origin_label }}
        </span>
      </div>
    </li>
  </ul>
</template>