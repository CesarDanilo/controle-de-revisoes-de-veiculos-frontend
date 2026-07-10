<script setup>
import { computed } from 'vue'
import { Car, TrendingUp } from '@lucide/vue'

const props = defineProps({
  vehicles: { type: Array, default: () => [] },
  people: { type: Array, default: () => [] },
  revisions: { type: Array, default: () => [] },
  isLoading: { type: Boolean, default: false },
})

const MS_PER_DAY = 1000 * 60 * 60 * 24

const formatDate = (date) => date.toLocaleDateString('pt-BR')

const isOverdue = (date) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date < today
}

// One prediction per vehicle that has at least 2 revisions on record —
// anything with fewer can't have a meaningful average interval yet.
const predictions = computed(() => {
  const results = []

  for (const vehicle of props.vehicles) {
    const vehicleRevisions = props.revisions
      .filter((r) => r.vehicle_id === vehicle.id && r.revision_date)
      .map((r) => ({ ...r, revision_date: new Date(r.revision_date) }))
      .sort((a, b) => a.revision_date - b.revision_date)

    if (vehicleRevisions.length < 2) continue

    let totalDays = 0
    for (let i = 1; i < vehicleRevisions.length; i++) {
      totalDays += (vehicleRevisions[i].revision_date - vehicleRevisions[i - 1].revision_date) / MS_PER_DAY
    }
    const avgDays = Math.round(totalDays / (vehicleRevisions.length - 1))

    const lastRevisionDate = vehicleRevisions[vehicleRevisions.length - 1].revision_date
    const predictedDate = new Date(lastRevisionDate)
    predictedDate.setDate(predictedDate.getDate() + avgDays)

    const person = props.people.find((p) => p.id === vehicle.people_id)

    results.push({
      vehicleId: vehicle.id,
      vehicleLabel: `${vehicle.model} · ${vehicle.license_plate}`,
      personName: person?.name || '—',
      avgDays,
      predictedDate,
      revisionCount: vehicleRevisions.length,
    })
  }

  return results.sort((a, b) => a.predictedDate - b.predictedDate)
})
</script>

<template>
  <div class="rounded-2xl border border-ink-100 bg-white p-6">
    <h2 class="text-base font-bold text-ink-900">Próximas revisões (previsão)</h2>
    <p class="mt-1 text-sm text-ink-500">Baseada no tempo médio entre revisões da people.</p>

    <!-- Loading -->
    <div v-if="isLoading" class="mt-5 flex flex-col gap-3">
      <div v-for="n in 3" :key="n" class="h-12 animate-pulse rounded-xl bg-ink-50" />
    </div>

    <!-- Not enough data yet -->
    <p v-else-if="!predictions.length" class="mt-5 text-sm text-ink-500">
      Registre pelo menos duas revisões por people para gerar previsões.
    </p>

    <!-- Predictions -->
    <ul v-else class="mt-5 flex flex-col divide-y divide-ink-100">
      <li
        v-for="prediction in predictions.slice(0, 6)"
        :key="prediction.vehicleId"
        class="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
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
            a cada ~{{ prediction.avgDays }} dias
          </p>
        </div>
      </li>
    </ul>

    <p v-if="predictions.length > 6" class="mt-3 text-xs text-ink-400">
      +{{ predictions.length - 6 }} veículo(s) com previsão calculada.
    </p>
  </div>
</template>