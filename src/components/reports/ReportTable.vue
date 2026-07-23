<script setup>
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from '@lucide/vue'

const props = defineProps({
  columns: { type: Array, required: true }, // [{ key: 'name', label: 'Nome' }]
  rows: { type: Array, required: true },
  emptyText: { type: String, default: 'Nenhum registro encontrado.' },
  // { currentPage, lastPage, perPage, total } — omita pra tabela sem paginação
  pagination: { type: Object, default: null },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['page-change'])

const hasPagination = computed(() => !!props.pagination && props.pagination.lastPage > 1)

const rangeLabel = computed(() => {
  if (!props.pagination || !props.pagination.total) return ''
  const { currentPage, perPage, total } = props.pagination
  const from = (currentPage - 1) * perPage + 1
  const to = Math.min(currentPage * perPage, total)
  return `Mostrando ${from}–${to} de ${total}`
})

// Janela de páginas visíveis (máx. 5 números, com "…" nas pontas quando necessário)
const visiblePages = computed(() => {
  if (!props.pagination) return []
  const { currentPage, lastPage } = props.pagination
  const delta = 1
  const range = []
  const withDots = []
  let last = null

  for (let i = 1; i <= lastPage; i++) {
    if (i === 1 || i === lastPage || (i >= currentPage - delta && i <= currentPage + delta)) {
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

const goToPage = (page) => {
  if (
    typeof page !== 'number' ||
    page < 1 ||
    page > props.pagination.lastPage ||
    page === props.pagination.currentPage ||
    props.loading
  ) {
    return
  }
  emit('page-change', page)
}
</script>

<template>
  <div>
    <div v-if="!rows.length" class="py-6 text-center text-sm text-ink-400">
      {{ emptyText }}
    </div>

    <div v-else class="overflow-x-auto" :class="{ 'opacity-60': loading }">
      <table class="w-full text-left text-sm">
        <thead class="text-ink-400">
          <tr>
            <th v-for="col in columns" :key="col.key" class="pb-2 pr-4 font-medium">
              {{ col.label }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-ink-50 text-ink-700">
          <tr v-for="(row, i) in rows" :key="i">
            <td v-for="col in columns" :key="col.key" class="py-2 pr-4">
              {{ row[col.key] }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="hasPagination"
      class="mt-4 flex flex-col items-center justify-between gap-3 border-t border-ink-100 pt-3 sm:flex-row"
    >
      <p class="text-xs text-ink-400">{{ rangeLabel }}</p>

      <div class="flex items-center gap-1">
        <button
          type="button"
          class="flex h-7 w-7 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          :disabled="pagination.currentPage <= 1 || loading"
          aria-label="Página anterior"
          @click="goToPage(pagination.currentPage - 1)"
        >
          <ChevronLeft :size="15" />
        </button>

        <template v-for="(page, idx) in visiblePages" :key="`${page}-${idx}`">
          <span v-if="page === '...'" class="px-1.5 text-xs text-ink-300">…</span>
          <button
            v-else
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            :class="
              page === pagination.currentPage
                ? 'bg-brand-600 text-white'
                : 'text-ink-600 hover:bg-ink-50'
            "
            :disabled="loading"
            :aria-current="page === pagination.currentPage ? 'page' : undefined"
            @click="goToPage(page)"
          >
            {{ page }}
          </button>
        </template>

        <button
          type="button"
          class="flex h-7 w-7 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          :disabled="pagination.currentPage >= pagination.lastPage || loading"
          aria-label="Próxima página"
          @click="goToPage(pagination.currentPage + 1)"
        >
          <ChevronRight :size="15" />
        </button>
      </div>
    </div>
  </div>
</template>