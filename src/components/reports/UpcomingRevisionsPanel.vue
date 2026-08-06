<script setup>
import { computed, onMounted, ref } from 'vue'
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { useUpcomingRevisions } from '../../composables/useUpcomingRevisions.js'
import UpcomingRevisionsList from './UpcomingRevisionsList.vue'
// 🔴 AQUI — mesmo modal já usado na tela de Pessoas, reaproveitado aqui
import RevisionsModal from '../people/RevisionsModal.vue'
// 🟢 NOVO — modal de escolha, aberto quando o veículo clicado tem mais de
// uma revisão pendente
import PendingRevisionsPickerModal from '../dashboard/PendingRevisionsPickerModal.vue'

const {
  items,
  isLoading,
  error,
  page,
  lastPage,
  total,
  fetchPage,
} = useUpcomingRevisions()

onMounted(() => fetchPage(1))

const hasPagination = computed(() => lastPage.value > 1)

// perPage inferido a partir da página atual (assume que só a última página é parcial)
const perPage = computed(() => {
  if (!items.value?.length) return 0
  return page.value < lastPage.value ? items.value.length : items.value.length
})

const rangeLabel = computed(() => {
  if (!total.value) return ''
  const per = items.value.length && page.value === lastPage.value
    ? total.value - (lastPage.value - 1) * (items.value.length || 1)
    : items.value.length
  const from = (page.value - 1) * (per || items.value.length || 1) + 1
  const to = Math.min(from + (items.value.length || 1) - 1, total.value)
  return `Mostrando ${from}–${to} de ${total.value}`
})

// Janela de páginas visíveis (máx. 5 números, com "…" nas pontas quando necessário)
const visiblePages = computed(() => {
  const delta = 1
  const range = []
  const withDots = []
  let last = null

  for (let i = 1; i <= lastPage.value; i++) {
    if (i === 1 || i === lastPage.value || (i >= page.value - delta && i <= page.value + delta)) {
      range.push(i)
    }
  }

  for (const i of range) {
    if (last !== null) {
      if (i - last === 2) withDots.push(last + 1)
      else if (i - last > 2) withDots.push('...')
    }
    withDots.push(i)
    last = i
  }

  return withDots
})

const goToPage = (target) => {
  if (
    typeof target !== 'number' ||
    target < 1 ||
    target > lastPage.value ||
    target === page.value ||
    isLoading.value
  ) {
    return
  }
  fetchPage(target)
}

// ---------------------------------------------------------------------
// MODAL DE REVISÕES — aberto ao clicar num item da lista (ou após a
// escolha no modal de seleção, quando há mais de uma pendência)
// ---------------------------------------------------------------------
const isModalOpen = ref(false)
const selectedPerson = ref(null)
const highlightVehicleId = ref(null)
const highlightRevisionId = ref(null)
// usados quando o item clicado NÃO é uma revisão agendada de
// verdade (é só uma previsão informada/estimada).
const prefillDate = ref(null)
const prefillKm = ref(null)

// ---------------------------------------------------------------------
// 🟢 NOVO — MODAL DE ESCOLHA, quando o veículo tem >1 revisão pendente
// ---------------------------------------------------------------------
const pickerItem = ref(null)

const pickerPredictions = computed(() => {
  if (!pickerItem.value) return []
  return pickerItem.value.predictions.map((prediction, index) => ({
    key: `${pickerItem.value.vehicle_id}-${prediction.revision_id ?? index}`,
    dateLabel: prediction.predicted_date_label,
    kmLabel: prediction.predicted_km
      ? `${Number(prediction.predicted_km).toLocaleString('pt-BR')} km`
      : null,
    originLabel: prediction.is_scheduled ? 'Agendada' : prediction.origin_label,
    payload: prediction,
  }))
})

// Abre de fato o RevisionsModal pra uma previsão específica (seja ela a
// única do veículo, seja a escolhida no modal de seleção).
const openForPrediction = (item, prediction) => {
  // sem person_id não dá pra montar o objeto que o RevisionsModal espera
  if (!item.person_id) return

  selectedPerson.value = { id: item.person_id, name: item.person_name }
  highlightVehicleId.value = item.vehicle_id ?? null

  if (prediction.is_scheduled) {
    highlightRevisionId.value = prediction.revision_id ?? null
    prefillDate.value = null
    prefillKm.value = null
  } else {
    highlightRevisionId.value = null
    prefillDate.value = prediction.predicted_date ? String(prediction.predicted_date).slice(0, 10) : null
    prefillKm.value = prediction.predicted_km ?? null
  }

  isModalOpen.value = true
}

// 🔧 CORRIGIDO — antes, clicar em qualquer item abria direto o modal de
// revisões usando a previsão mais próxima daquele veículo, mesmo quando
// existiam OUTRAS revisões pendentes pro mesmo veículo — o usuário podia
// cair numa revisão diferente da que pretendia iniciar, sem perceber que
// havia mais de uma pendência. Agora: se o veículo tem só 1 previsão,
// comportamento igual a antes; se tem mais de 1, abre primeiro o modal de
// escolha (PendingRevisionsPickerModal) e só continua depois da seleção.
const handleSelect = (item) => {
  if ((item.predictions_count ?? 1) > 1) {
    pickerItem.value = item
    return
  }

  openForPrediction(item, item)
}

const handlePickPrediction = (pickedOption) => {
  const item = pickerItem.value
  pickerItem.value = null
  if (!item) return
  openForPrediction(item, pickedOption.payload)
}

const closePicker = () => {
  pickerItem.value = null
}

// 🔧 CORRIGIDO — ao fechar o modal, refaz a busca da página atual
// (fetchPage). Essa lista NÃO usa Vue Query (é o composable manual
// useUpcomingRevisions), então qualquer revisão criada/editada dentro do
// modal (ex: uma nova "próxima revisão" informada) não aparecia aqui até
// o usuário sair e voltar da tela de Relatórios. Agora atualiza sozinho
// assim que o modal fecha, refletindo a nova data/KM na hora.
const closeModal = () => {
  isModalOpen.value = false
  selectedPerson.value = null
  highlightVehicleId.value = null
  highlightRevisionId.value = null
  prefillDate.value = null
  prefillKm.value = null
  fetchPage(page.value)
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="isLoading" class="py-8 text-center text-sm text-ink-400">
      Carregando revisões...
    </div>

    <div v-else-if="error" class="py-8 text-center text-sm text-red-600">
      {{ error }}
    </div>

    <template v-else>
      <UpcomingRevisionsList :items="items" @select="handleSelect" />

      <div
        v-if="hasPagination"
        class="mt-1 flex flex-col items-center justify-between gap-3 border-t border-ink-100 pt-3 sm:flex-row"
      >
        <p class="text-xs text-ink-400">{{ rangeLabel }}</p>

        <div class="flex items-center gap-1">
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            :disabled="page <= 1 || isLoading"
            aria-label="Página anterior"
            @click="goToPage(page - 1)"
          >
            <ChevronLeft :size="15" />
          </button>

          <template v-for="(p, idx) in visiblePages" :key="`${p}-${idx}`">
            <span v-if="p === '...'" class="px-1.5 text-xs text-ink-300">…</span>
            <button
              v-else
              type="button"
              class="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              :class="
                p === page
                  ? 'bg-brand-600 text-white'
                  : 'text-ink-600 hover:bg-ink-50'
              "
              :disabled="isLoading"
              :aria-current="p === page ? 'page' : undefined"
              @click="goToPage(p)"
            >
              {{ p }}
            </button>
          </template>

          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            :disabled="page >= lastPage || isLoading"
            aria-label="Próxima página"
            @click="goToPage(page + 1)"
          >
            <ChevronRight :size="15" />
          </button>
        </div>
      </div>
    </template>

    <PendingRevisionsPickerModal
      v-if="pickerItem"
      :vehicle-label="pickerItem.vehicle"
      :person-name="pickerItem.person_name"
      :predictions="pickerPredictions"
      @select="handlePickPrediction"
      @close="closePicker"
    />

    <RevisionsModal
      v-if="isModalOpen"
      :person="selectedPerson"
      :highlight-vehicle-id="highlightVehicleId"
      :highlight-revision-id="highlightRevisionId"
      :prefill-date="prefillDate"
      :prefill-km="prefillKm"
      @close="closeModal"
      @register-vehicle="closeModal"
    />
  </div>
</template>