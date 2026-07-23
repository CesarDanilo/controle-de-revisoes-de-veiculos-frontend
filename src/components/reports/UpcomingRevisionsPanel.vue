<script setup>
import { computed, onMounted } from 'vue'
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { useUpcomingRevisions } from '../../composables/useUpcomingRevisions.js'
import UpcomingRevisionsList from './UpcomingRevisionsList.vue'

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
      <UpcomingRevisionsList :items="items" />

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
  </div>
</template>