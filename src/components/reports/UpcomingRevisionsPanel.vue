<script setup>
import { computed, onMounted, ref } from 'vue'
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { useUpcomingRevisions } from '../../composables/useUpcomingRevisions.js'
import UpcomingRevisionsList from './UpcomingRevisionsList.vue'
// 🔴 AQUI — mesmo modal já usado na tela de Pessoas, reaproveitado aqui
import RevisionsModal from '../people/RevisionsModal.vue'

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
// MODAL DE REVISÕES — aberto ao clicar num item da lista
// ---------------------------------------------------------------------
const isModalOpen = ref(false)
const selectedPerson = ref(null)
const highlightVehicleId = ref(null)
const highlightRevisionId = ref(null)
// usados quando o item clicado NÃO é uma revisão agendada de
// verdade (é só uma previsão informada/estimada).
const prefillDate = ref(null)
const prefillKm = ref(null)

// clicar em qualquer item, mesmo os de data informada/estimada (que ainda
// não são um registro de verdade), só entra em modo edição quando o item
// é realmente uma revisão futura agendada (is_scheduled); nos demais
// casos, abre o formulário de CRIAÇÃO já com a data (e KM) prevista
// preenchidos.
const handleSelect = (item) => {
  // sem person_id não dá pra montar o objeto que o RevisionsModal espera
  if (!item.person_id) return

  selectedPerson.value = { id: item.person_id, name: item.person_name }
  highlightVehicleId.value = item.vehicle_id ?? null

  if (item.is_scheduled) {
    highlightRevisionId.value = item.revision_id ?? null
    prefillDate.value = null
    prefillKm.value = null
  } else {
    highlightRevisionId.value = null
    prefillDate.value = item.predicted_date ? String(item.predicted_date).slice(0, 10) : null
    prefillKm.value = item.predicted_km ?? null
  }

  isModalOpen.value = true
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