<script setup>
import { computed, ref } from 'vue'
import { useInfiniteQuery, useQueryClient } from '@tanstack/vue-query'
import { Car, TrendingUp, ArrowUpRight, AlertTriangle, RefreshCw, Calendar } from '@lucide/vue'
import { reportService } from '../../services/report.service'

const emit = defineEmits(['edit-vehicle'])

// 🔴 AQUI — FIX timezone: strings "yyyy-mm-dd" vindas da API não têm hora,
// então `new Date(str)` interpreta como meia-noite UTC. Forçando T00:00:00
// o Date é criado no fuso LOCAL, evitando um desvio de 1 dia em fusos atrás
// de UTC (ex: Brasil).
const parseLocalDate = (dateStr) => {
  const isoPart = String(dateStr).slice(0, 10)
  return new Date(`${isoPart}T00:00:00`)
}

const formatDate = (date) => date.toLocaleDateString('pt-BR')

// 🔧 CORRIGIDO — antes o dedupe só removia duplicata quando VEÍCULO + DATA
// batiam exatamente. Mas o mesmo veículo pode ter previsões futuras
// diferentes (ex: uma "informada" pra 29/09 vinda de uma revisão antiga, e
// uma "agendada" pra 30/09 vinda de uma revisão real já cadastrada) — nesse
// caso a lista mostrava as DUAS, quando só faz sentido mostrar a PRÓXIMA
// revisão de fato daquele veículo.
//
// Regra nova: agrupa só por veículo (ignora a data no agrupamento) e
// mantém a entrada com a data mais PRÓXIMA — seja ela informada, estimada
// ou agendada. Em caso de empate exato de data, a agendada vence (é um
// registro real, não um palpite).
const dedupeByVehicleKeepNearest = (rawItems) => {
  const map = new Map()

  for (const item of rawItems) {
    const key = item.vehicle_id
    const existing = map.get(key)

    if (!existing) {
      map.set(key, item)
      continue
    }

    const existingDate = existing.predicted_date ? new Date(existing.predicted_date) : null
    const itemDate = item.predicted_date ? new Date(item.predicted_date) : null

    if (!itemDate) continue

    if (!existingDate || itemDate < existingDate) {
      map.set(key, item)
      continue
    }

    if (itemDate.getTime() === existingDate.getTime() && item.is_scheduled && !existing.is_scheduled) {
      map.set(key, item)
    }
  }

  // reordena por data prevista, já que a remoção de itens pode ter
  // desordenado a lista original vinda da API
  return Array.from(map.values()).sort((a, b) => {
    const dateA = a.predicted_date ? new Date(a.predicted_date) : null
    const dateB = b.predicted_date ? new Date(b.predicted_date) : null
    if (!dateA) return 1
    if (!dateB) return -1
    return dateA - dateB
  })
}

// 🟡 MANTIDO — mapeia o formato que a API já manda. is_scheduled continua
// vindo do backend, agora corretamente marcado para CADA revisão agendada
// (não mais só a "mais distante" de cada veículo).
//
// 🟡 MANTIDO — predictedDateISO e predictedKm: usados só quando a previsão
// NÃO é agendada (is_scheduled = false). Nesses casos o "revision_id" que
// a API manda aponta pra revisão ANTIGA (a que originou a previsão via
// next_revision_date ou pela média de intervalo) — não existe ainda uma
// revisão de verdade pra essa data futura. Guardamos a data/KM previstos
// em formato "cru" pra poder pré-preencher o formulário de CRIAÇÃO de uma
// revisão nova, em vez de abrir a revisão antiga em modo edição.
const mapPrediction = (item) => ({
  vehicleId: item.vehicle_id,
  personId: item.person_id,
  lastRevisionId: item.revision_id,
  vehicleLabel: item.vehicle_plate ? `${item.vehicle} · ${item.vehicle_plate}` : item.vehicle,
  personName: item.person_name || '—',
  avgDays: item.avg_interval_days,
  predictedDate: parseLocalDate(item.predicted_date),
  predictedDateISO: item.predicted_date ? String(item.predicted_date).slice(0, 10) : null,
  predictedKm: item.predicted_km ?? null,
  isEstimated: item.is_estimated_date,
  isScheduled: item.is_scheduled,
})

// 🟢 NOVO — checa se a resposta paginada do Laravel ainda tem próxima página.
// Ajuste os nomes ('current_page'/'last_page') se seu paginate() customizado
// devolver outro formato (ex: se usar um Resource/Transformer diferente).
const getNextPageParam = (lastPage) => {
  const current = lastPage?.current_page ?? 1
  const last = lastPage?.last_page ?? 1
  return current < last ? current + 1 : undefined
}

const flattenPages = (pages) => (pages ?? []).flatMap((page) => page?.data ?? [])

// ---------------------------------------------------------------------
// LISTA "PRÓXIMAS" — scroll infinito próprio
// ---------------------------------------------------------------------
const {
  data: upcomingPages,
  isLoading: isLoadingUpcoming,
  isFetchingNextPage: isFetchingNextUpcoming,
  hasNextPage: hasNextUpcoming,
  fetchNextPage: fetchNextUpcoming,
} = useInfiniteQuery({
  queryKey: ['upcoming-revisions', 'upcoming'],
  queryFn: ({ pageParam = 1 }) =>
    reportService.getUpcomingRevisions({ type: 'upcoming', per_page: 10, page: pageParam }),
  getNextPageParam,
})

// 🔧 CORRIGIDO — usa dedupeByVehicleKeepNearest, que mantém só a previsão
// mais próxima por veículo (em vez de uma por veículo+data).
const upcomingPredictions = computed(() =>
  dedupeByVehicleKeepNearest(flattenPages(upcomingPages.value?.pages)).map(mapPrediction)
)

// ---------------------------------------------------------------------
// LISTA "ATRASADAS" — scroll infinito próprio, independente da acima
// ---------------------------------------------------------------------
const {
  data: overduePages,
  isLoading: isLoadingOverdue,
  isFetchingNextPage: isFetchingNextOverdue,
  hasNextPage: hasNextOverdue,
  fetchNextPage: fetchNextOverdue,
} = useInfiniteQuery({
  queryKey: ['upcoming-revisions', 'overdue'],
  queryFn: ({ pageParam = 1 }) =>
    reportService.getUpcomingRevisions({ type: 'overdue', per_page: 10, page: pageParam }),
  getNextPageParam,
})

// 🔧 CORRIGIDO — mesma deduplicação aplicada na lista de atrasadas.
const overduePredictions = computed(() =>
  dedupeByVehicleKeepNearest(flattenPages(overduePages.value?.pages)).map(mapPrediction)
)

const isLoading = computed(() => isLoadingUpcoming.value && isLoadingOverdue.value)
const hasAnyPrediction = computed(
  () => upcomingPredictions.value.length > 0 || overduePredictions.value.length > 0
)

// ---------------------------------------------------------------------
// SCROLL INFINITO — detecta quando o usuário chega perto do fim de CADA
// lista e dispara fetchNextPage() daquela lista específica. threshold em
// px: dispara um pouco antes de bater no fundo, pra sensação ficar suave.
// ---------------------------------------------------------------------
const SCROLL_THRESHOLD = 48

const handleUpcomingScroll = (event) => {
  const el = event.target
  const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD
  if (nearBottom && hasNextUpcoming.value && !isFetchingNextUpcoming.value) {
    fetchNextUpcoming()
  }
}

const handleOverdueScroll = (event) => {
  const el = event.target
  const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD
  if (nearBottom && hasNextOverdue.value && !isFetchingNextOverdue.value) {
    fetchNextOverdue()
  }
}

// 🟡 MANTIDO — is_scheduled = true -> revisão futura REAL já cadastrada.
// Abre em modo edição. is_scheduled = false -> só uma previsão (informada
// ou estimada). Abre o formulário de CRIAÇÃO de uma revisão nova, no
// veículo certo, com a data (e KM, se houver) prevista já preenchidos.
// Com a deduplicação por veículo, agora só chega aqui UMA entrada por
// veículo em cada lista, então essa distinção volta a ser confiável.
const handleSelect = (prediction) => {
  if (prediction.isScheduled) {
    emit('edit-vehicle', {
      vehicleId: prediction.vehicleId,
      personId: prediction.personId,
      revisionId: prediction.lastRevisionId,
      prefillDate: null,
      prefillKm: null,
    })
    return
  }

  emit('edit-vehicle', {
    vehicleId: prediction.vehicleId,
    personId: prediction.personId,
    revisionId: null,
    prefillDate: prediction.predictedDateISO,
    prefillKm: prediction.predictedKm,
  })
}
</script>

<template>
  <div class="rounded-2xl border border-ink-100 bg-white p-6">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h2 class="text-base font-bold text-ink-900">Próximas revisões (previsão)</h2>
        <p class="mt-1 text-sm text-ink-500">Data informada, agendada ou, na ausência delas, estimada pelo intervalo médio.</p>
      </div>

      <router-link
        to="/relatorios#proximas-revisoes"
        class="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        Ver relatórios
        <ArrowUpRight :size="14" />
      </router-link>
    </div>

    <!-- Loading inicial (as duas listas ainda não carregaram nada) -->
    <div v-if="isLoading" class="mt-5 flex flex-col gap-3">
      <div v-for="n in 3" :key="n" class="h-12 animate-pulse rounded-xl bg-ink-50" />
    </div>

    <!-- Sem dados suficientes em nenhuma das duas listas -->
    <p v-else-if="!hasAnyPrediction" class="mt-5 text-sm text-ink-500">
      Registre uma data de próxima revisão, agende uma revisão futura, ou registre pelo menos duas revisões por veículo para gerar previsões.
    </p>

    <template v-else>
      <!-- ====== BLOCO "PRÓXIMAS" — barra de rolagem própria ====== -->
      <div class="mt-5">
        <p class="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">
          Próximas ({{ upcomingPredictions.length }})
        </p>

        <div
          class="max-h-64 overflow-y-auto pr-1"
          @scroll="handleUpcomingScroll"
        >
          <ul v-if="upcomingPredictions.length" class="flex flex-col divide-y divide-ink-100">
            <li
              v-for="prediction in upcomingPredictions"
              :key="`${prediction.vehicleId}-${prediction.lastRevisionId}`"
              role="button"
              tabindex="0"
              class="flex cursor-pointer items-center justify-between gap-3 rounded-lg py-3 px-2 -mx-2 transition-colors first:pt-0 hover:bg-ink-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
              @click="handleSelect(prediction)"
              @keydown.enter="handleSelect(prediction)"
            >
              <div class="flex min-w-0 items-center gap-3">
                <span
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  :class="prediction.isScheduled ? 'bg-amber-50 text-amber-600' : 'bg-brand-50 text-brand-600'"
                >
                  <Calendar v-if="prediction.isScheduled" :size="16" />
                  <Car v-else :size="16" />
                </span>
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-ink-900">{{ prediction.vehicleLabel }}</p>
                  <p class="truncate text-xs text-ink-500">{{ prediction.personName }}</p>
                </div>
              </div>

              <div class="shrink-0 text-right">
                <p class="text-sm font-semibold text-ink-900">
                  {{ formatDate(prediction.predictedDate) }}
                </p>
                <p class="flex items-center justify-end gap-1 text-[11px] text-ink-400">
                  <TrendingUp :size="11" />
                  <template v-if="prediction.isScheduled">agendada</template>
                  <template v-else-if="prediction.isEstimated">a cada ~{{ prediction.avgDays }} dias</template>
                  <template v-else>data informada</template>
                </p>
              </div>
            </li>
          </ul>

          <p v-else class="py-3 text-sm text-ink-500">
            Nenhuma revisão futura prevista no momento.
          </p>

          <!-- indicador de carregamento ao rolar até o fim -->
          <div v-if="isFetchingNextUpcoming" class="flex justify-center py-3">
            <RefreshCw :size="14" class="animate-spin text-ink-400" />
          </div>
        </div>
      </div>

      <!-- ====== BLOCO "ATRASADAS" — barra de rolagem própria ====== -->
      <div v-if="overduePredictions.length || isLoadingOverdue" class="mt-6">
        <div class="mb-2 flex items-center gap-2">
          <AlertTriangle :size="13" class="text-red-500" />
          <p class="text-xs font-medium uppercase tracking-wide text-red-500">
            Atrasadas ({{ overduePredictions.length }})
          </p>
        </div>

        <div
          class="max-h-64 overflow-y-auto pr-1"
          @scroll="handleOverdueScroll"
        >
          <ul v-if="overduePredictions.length" class="flex flex-col divide-y divide-ink-100">
            <li
              v-for="prediction in overduePredictions"
              :key="`${prediction.vehicleId}-${prediction.lastRevisionId}`"
              role="button"
              tabindex="0"
              class="flex cursor-pointer items-center justify-between gap-3 rounded-lg py-3 px-2 -mx-2 transition-colors first:pt-0 hover:bg-ink-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
              @click="handleSelect(prediction)"
              @keydown.enter="handleSelect(prediction)"
            >
              <div class="flex min-w-0 items-center gap-3">
                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500">
                  <Car :size="16" />
                </span>
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-ink-900">{{ prediction.vehicleLabel }}</p>
                  <p class="truncate text-xs text-ink-500">{{ prediction.personName }}</p>
                </div>
              </div>

              <div class="shrink-0 text-right">
                <p class="text-sm font-semibold text-red-600">
                  {{ formatDate(prediction.predictedDate) }}
                </p>
                <p class="flex items-center justify-end gap-1 text-[11px] text-ink-400">
                  <TrendingUp :size="11" />
                  <template v-if="prediction.isScheduled">agendada</template>
                  <template v-else-if="prediction.isEstimated">a cada ~{{ prediction.avgDays }} dias</template>
                  <template v-else>data informada</template>
                </p>
              </div>
            </li>
          </ul>

          <!-- indicador de carregamento ao rolar até o fim -->
          <div v-if="isFetchingNextOverdue" class="flex justify-center py-3">
            <RefreshCw :size="14" class="animate-spin text-ink-400" />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>