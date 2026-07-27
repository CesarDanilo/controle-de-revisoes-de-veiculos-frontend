<script setup>
import { computed } from 'vue'
import { Car, TrendingUp } from '@lucide/vue'

const props = defineProps({
  vehicles: { type: Array, default: () => [] },
  people: { type: Array, default: () => [] },
  revisions: { type: Array, default: () => [] },
  isLoading: { type: Boolean, default: false },
})

const emit = defineEmits(['edit-vehicle'])

const MS_PER_DAY = 1000 * 60 * 60 * 24

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

// One prediction per vehicle:
// - se a última revisão tem "next_revision_date" informado, usa ele direto (data exata);
// - senão, estima pela média de intervalo entre as revisões (precisa de pelo menos 2).
const predictions = computed(() => {
  const results = []

  for (const vehicle of props.vehicles) {
    const vehicleRevisions = props.revisions
      .filter((r) => r.vehicle_id === vehicle.id && r.revision_date)
      .map((r) => ({ ...r, revision_date: parseLocalDate(r.revision_date) }))
      .sort((a, b) => a.revision_date - b.revision_date)

    if (vehicleRevisions.length === 0) continue

    const lastRevision = vehicleRevisions[vehicleRevisions.length - 1]

    // 🔴 AQUI — data da próxima revisão informada manualmente (prioridade
    // máxima, é um valor exato e não uma estimativa)
    const informedDate = lastRevision.next_revision_date
      ? parseLocalDate(lastRevision.next_revision_date)
      : null

    // 🔴 AQUI — só calcula a média se houver pelo menos 2 revisões no
    // histórico; do contrário fica null (sem estimativa possível)
    let avgDays = null
    if (vehicleRevisions.length >= 2) {
      let totalDays = 0
      for (let i = 1; i < vehicleRevisions.length; i++) {
        totalDays += (vehicleRevisions[i].revision_date - vehicleRevisions[i - 1].revision_date) / MS_PER_DAY
      }
      avgDays = Math.round(totalDays / (vehicleRevisions.length - 1))
    }

    // Sem data informada e sem histórico suficiente pra estimar: não dá pra prever esse veículo.
    if (!informedDate && avgDays === null) continue

    // 🔴 AQUI — a data da PRÓXIMA revisão: usa a informada; se não houver,
    // estima a partir da última revisão + média de dias
    const predictedDate = informedDate ?? (() => {
      const d = new Date(lastRevision.revision_date)
      d.setDate(d.getDate() + avgDays)
      return d
    })()

    const isEstimated = !informedDate

    const person = props.people.find((p) => p.id === vehicle.people_id)

    results.push({
      vehicleId: vehicle.id,
      vehicle, // objeto completo, usado no clique para abrir o modal em modo edição
      // 🔴 AQUI — id da última revisão real (a que gerou a previsão), usado
      // para abrir o RevisionsModal já em modo edição, pré-preenchido com
      // os dados dela
      lastRevisionId: lastRevision.id,
      vehicleLabel: `${vehicle.model} · ${vehicle.license_plate}`,
      personName: person?.name || '—',
      avgDays,
      predictedDate,
      isEstimated,
      revisionCount: vehicleRevisions.length,
    })
  }

  return results.sort((a, b) => a.predictedDate - b.predictedDate)
})

const handleSelect = (prediction) => {
  // 🔴 AQUI — agora emite também o id da revisão, pro pai poder abrir o
  // modal já em modo edição nessa revisão específica
  emit('edit-vehicle', prediction.vehicle, prediction.lastRevisionId)
}
</script>

<template>
  <div class="rounded-2xl border border-ink-100 bg-white p-6">
    <h2 class="text-base font-bold text-ink-900">Próximas revisões (previsão)</h2>
    <p class="mt-1 text-sm text-ink-500">Data informada ou, na ausência dela, estimada pelo intervalo médio.</p>

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
        v-for="prediction in predictions.slice(0, 6)"
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

    <p v-if="predictions.length > 6" class="mt-3 text-xs text-ink-400">
      +{{ predictions.length - 6 }} veículo(s) com previsão calculada.
    </p>
  </div>
</template>