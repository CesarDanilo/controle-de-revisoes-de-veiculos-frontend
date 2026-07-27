<script setup>
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { Car, TrendingUp, ArrowUpRight } from '@lucide/vue'
import { reportService } from '../../services/report.service'

const emit = defineEmits(['edit-vehicle'])

// 🟢 NOVO — o componente agora busca seus próprios dados, já prontos
// (previsão calculada em SQL no backend, não mais em JS aqui). Não recebe
// mais "vehicles" / "people" / "revisions" como props.
const { data, isLoading } = useQuery({
  queryKey: ['upcoming-revisions'],
  queryFn: () => reportService.getUpcomingRevisions({ per_page: 6 }),
})

// 🔴 AQUI — FIX timezone: strings "yyyy-mm-dd" vindas da API não têm hora,
// então `new Date(str)` interpreta como meia-noite UTC. Ao converter pra
// local (toLocaleDateString), isso pode "voltar" um dia inteiro em fusos
// atrás de UTC (ex: Brasil). Forçando T00:00:00 o Date é criado no fuso
// LOCAL, evitando esse desvio.
const parseLocalDate = (dateStr) => {
  const isoPart = String(dateStr).slice(0, 10)
  return new Date(`${isoPart}T00:00:00`)
}

const formatDate = (date) => date.toLocaleDateString('pt-BR')

const isOverdue = (date) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date < today
}

// 🟢 NOVO — só mapeia o formato que a API já manda, sem recalcular nada
const predictions = computed(() =>
  (data.value ?? []).map((item) => ({
    vehicleId: item.vehicle_id,
    personId: item.person_id,
    // usado pelo pai pra abrir o RevisionsModal já em modo edição
    lastRevisionId: item.revision_id,
    vehicleLabel: item.vehicle_plate ? `${item.vehicle} · ${item.vehicle_plate}` : item.vehicle,
    personName: item.person_name || '—',
    avgDays: item.avg_interval_days,
    predictedDate: parseLocalDate(item.predicted_date),
    isEstimated: item.is_estimated_date,
  }))
)

const handleSelect = (prediction) => {
  // 🟡 ALTERADO — antes emitia o objeto "vehicle" inteiro; agora emite os
  // IDs (vehicleId, personId, lastRevisionId), já que o card não tem mais
  // os objetos completos de vehicle/people. O Dashboard.vue precisa ser
  // ajustado pra receber esse novo formato (ver openRevisionsModal).
  emit('edit-vehicle', {
    vehicleId: prediction.vehicleId,
    personId: prediction.personId,
    revisionId: prediction.lastRevisionId,
  })
}
</script>

<template>
  <div class="rounded-2xl border border-ink-100 bg-white p-6">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h2 class="text-base font-bold text-ink-900">Próximas revisões (previsão)</h2>
        <p class="mt-1 text-sm text-ink-500">Data informada ou, na ausência dela, estimada pelo intervalo médio.</p>
      </div>

      <!-- 🟢 NOVO — atalho pra tela de relatórios, que tem o detalhamento completo -->
      <router-link
        to="/relatorios#proximas-revisoes"
        class="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        Ver relatórios
        <ArrowUpRight :size="14" />
      </router-link>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="mt-5 flex flex-col gap-3">
      <div v-for="n in 3" :key="n" class="h-12 animate-pulse rounded-xl bg-ink-50" />
    </div>

    <!-- Not enough data yet -->
    <p v-else-if="!predictions.length" class="mt-5 text-sm text-ink-500">
      Registre uma data de próxima revisão ou pelo menos duas revisões por veículo para gerar previsões.
    </p>

    <!-- Predictions -->
    <ul v-else class="mt-5 flex flex-col divide-y divide-ink-100">
      <li
        v-for="prediction in predictions"
        :key="prediction.vehicleId"
        role="button"
        tabindex="0"
        class="flex cursor-pointer items-center justify-between gap-3 rounded-lg py-3 px-2 -mx-2 transition-colors first:pt-0 last:pb-0 hover:bg-ink-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
        @click="handleSelect(prediction)"
        @keydown.enter="handleSelect(prediction)"
      >
        <div class="flex min-w-0 items-center gap-3">
          <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Car :size="16" />
          </span>
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-ink-900">{{ prediction.vehicleLabel }}</p>
            <p class="truncate text-xs text-ink-500">{{ prediction.personName }}</p>
          </div>
        </div>

        <div class="shrink-0 text-right">
          <p
            class="text-sm font-semibold"
            :class="isOverdue(prediction.predictedDate) ? 'text-red-600' : 'text-ink-900'"
          >
            {{ formatDate(prediction.predictedDate) }}
          </p>
          <p class="flex items-center justify-end gap-1 text-[11px] text-ink-400">
            <TrendingUp :size="11" />
            <template v-if="prediction.isEstimated">a cada ~{{ prediction.avgDays }} dias</template>
            <template v-else>data informada</template>
          </p>
        </div>
      </li>
    </ul>
  </div>
</template>