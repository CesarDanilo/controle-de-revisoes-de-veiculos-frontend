<script setup>
import { computed, onMounted, ref } from 'vue'
import { Trash2, RotateCcw, User, Car, Wrench, X, ChevronLeft, ChevronRight, Search } from '@lucide/vue'
import AppShell from '../components/layout/AppShell.vue'
import EmptyState from '../components/dashboard/EmptyState.vue'
import ConfirmModal from '../components/ui/ConfirmModal.vue'
import { useLixeira } from '../composables/useLixeira'
import { useToast } from '../composables/useToast'

const {
  itens,
  isLoading,
  errorMessage,
  currentPage,
  lastPage,
  total,
  fetchLixeira,
  restaurarItem,
  excluirPermanentemente,
} = useLixeira()

const toast = useToast()

const restaurandoId = ref(null)
const excluindoId = ref(null)

const isConfirmOpen = ref(false)
const itemParaExcluir = ref(null)

// --- Metadados por tipo: ícone, nome e cor do badge ---
const TIPOS = {
  people: { icon: User, label: 'Proprietário', badge: 'bg-blue-50 text-blue-600' },
  vehicle: { icon: Car, label: 'Carro', badge: 'bg-purple-50 text-purple-600' },
  revisions: { icon: Wrench, label: 'Revisão', badge: 'bg-emerald-50 text-emerald-600' },
}

const iconeFor = (tabela) => TIPOS[tabela]?.icon || Trash2
const nomeFor = (tabela) => TIPOS[tabela]?.label || tabela
const badgeClassFor = (tabela) => TIPOS[tabela]?.badge || 'bg-ink-50 text-ink-500'

const TIPO_OPTIONS = [
  { value: '', label: 'Todos os tipos' },
  { value: 'people', label: 'Proprietário' },
  { value: 'vehicle', label: 'Carro' },
  { value: 'revisions', label: 'Revisão' },
]

const nomeDoRegistro = (item) => {
  const dados = item?.dados
  if (!dados) return '—'

  if (item.tabela_origem === 'revisions') {
    return dados.description ?? '—'
  }

  if (item.tabela_origem === 'vehicle') {
    return dados.license_plate ?? dados.model ?? '—'
  }

  return dados.name ?? '—'
}

const formatarData = (data) => {
  if (!data) return '—'
  return new Date(data).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// --- Filtros (busca no backend, com debounce) ---
const filtroBusca = ref('')
const filtroTipo = ref('')

let debounceTimer = null
const DEBOUNCE_MS = 400

// 🟢 Ajuste: usado pelo rangeLabel abaixo — mesmo per_page que o composable usa
const PER_PAGE = 10

const carregarComFiltros = (page = 1) => {
  fetchLixeira(page, {
    busca: filtroBusca.value || undefined,
    tipo: filtroTipo.value || undefined,
  })
}

const onBuscaInput = () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => carregarComFiltros(1), DEBOUNCE_MS)
}

const onTipoChange = () => {
  clearTimeout(debounceTimer)
  carregarComFiltros(1)
}

const hasActiveFilters = computed(() => filtroBusca.value.trim() !== '' || filtroTipo.value !== '')

const limparFiltros = () => {
  clearTimeout(debounceTimer)
  filtroBusca.value = ''
  filtroTipo.value = ''
  carregarComFiltros(1)
}
// --- fim filtros ---

const restaurar = async (item) => {
  restaurandoId.value = item.id
  try {
    await restaurarItem(item.id)
    toast.success(`${nomeFor(item.tabela_origem)} restaurado com sucesso!`)
  } catch (error) {
    if (error.response?.status === 410) {
      toast.error('Este item expirou e não pode mais ser restaurado.')
      await carregarComFiltros(currentPage.value)
    } else {
      toast.error('Não foi possível restaurar este item.')
    }
  } finally {
    restaurandoId.value = null
  }
}

const askExcluir = (item) => {
  itemParaExcluir.value = item
  isConfirmOpen.value = true
}

const closeConfirm = () => {
  isConfirmOpen.value = false
  itemParaExcluir.value = null
}

const confirmarExclusao = async () => {
  if (!itemParaExcluir.value) return
  excluindoId.value = itemParaExcluir.value.id
  try {
    await excluirPermanentemente(itemParaExcluir.value.id)
    toast.success('Item excluído permanentemente.')
    closeConfirm()
  } catch (error) {
    toast.error('Não foi possível excluir este item.')
  } finally {
    excluindoId.value = null
  }
}

// --- Paginação (mesmo padrão do DataTable.vue) ---
const hasPagination = computed(() => lastPage.value > 1)

const rangeLabel = computed(() => {
  if (!total.value) return ''
  const from = (currentPage.value - 1) * PER_PAGE + 1
  const to = Math.min(currentPage.value * PER_PAGE, total.value)
  return `Mostrando ${from}–${to} de ${total.value}`
})

// Janela de páginas visíveis (máx. 5 números, com "…" nas pontas quando necessário)
const visiblePages = computed(() => {
  const delta = 1
  const range = []
  const withDots = []
  let last = null

  for (let i = 1; i <= lastPage.value; i++) {
    if (i === 1 || i === lastPage.value || (i >= currentPage.value - delta && i <= currentPage.value + delta)) {
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

const irParaPagina = (page) => {
  if (
    typeof page !== 'number' ||
    page < 1 ||
    page > lastPage.value ||
    page === currentPage.value ||
    isLoading.value
  ) {
    return
  }
  carregarComFiltros(page)
}
// --- fim paginação ---

onMounted(() => carregarComFiltros(1))
</script>

<template>
  <AppShell title="Lixeira" subtitle="Itens excluídos podem ser recuperados em até 7 dias.">
    <!-- Barra de filtros -->
    <div class="mb-4 rounded-2xl border border-ink-100/70 bg-white p-4 shadow-sm shadow-ink-900/[0.03]">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="relative sm:col-span-2">
          <Search :size="14" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            v-model="filtroBusca"
            type="text"
            placeholder="Buscar por nome, descrição ou placa"
            class="w-full rounded-xl border border-ink-100 py-2 pl-9 pr-3 text-sm text-ink-700 placeholder:text-ink-300 focus:border-brand-400 focus:outline-none"
            @input="onBuscaInput"
          />
        </div>

        <select
          v-model="filtroTipo"
          class="w-full rounded-xl border border-ink-100 py-2 px-3 text-sm text-ink-700 focus:border-brand-400 focus:outline-none"
          @change="onTipoChange"
        >
          <option v-for="opcao in TIPO_OPTIONS" :key="opcao.value" :value="opcao.value">
            {{ opcao.label }}
          </option>
        </select>
      </div>

      <div v-if="hasActiveFilters" class="mt-3 flex items-center gap-2">
        <span class="text-xs text-ink-500">{{ total }} encontrado(s)</span>
        <button
          type="button"
          class="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-600"
          @click="limparFiltros"
        >
          <X :size="14" />
          Limpar filtros
        </button>
      </div>
    </div>

    <div v-if="isLoading" class="py-12 text-center text-sm text-ink-500">
      Carregando lixeira...
    </div>

    <div v-else-if="errorMessage" class="py-12 text-center text-sm text-red-600">
      {{ errorMessage }}
    </div>

    <EmptyState
      v-else-if="!(itens ?? []).length"
      :icon="Trash2"
      :title="hasActiveFilters ? 'Nenhum item encontrado' : 'A lixeira está vazia'"
      :description="hasActiveFilters ? 'Ajuste os filtros para encontrar o item desejado.' : 'Itens excluídos aparecem aqui e podem ser restaurados por até 7 dias.'"
    />

    <template v-else>
      <!-- mobile: cards -->
      <div class="flex flex-col gap-3 sm:hidden">
        <div
          v-for="item in itens ?? []"
          :key="item.id"
          class="rounded-2xl border border-ink-100/70 bg-white p-4 shadow-sm shadow-ink-900/[0.03]"
        >
          <div class="flex items-center gap-3">
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <component :is="iconeFor(item.tabela_origem)" :size="16" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-ink-900">{{ nomeDoRegistro(item) }}</p>
              <span class="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" :class="badgeClassFor(item.tabela_origem)">
                {{ nomeFor(item.tabela_origem) }}
              </span>
            </div>
          </div>

          <div class="mt-3 flex items-center justify-between text-xs text-ink-500">
            <span>Excluído em {{ formatarData(item.excluido_em) }}</span>
            <span
              class="rounded-full px-2 py-0.5 font-medium"
              :class="item.dias_restantes <= 2 ? 'bg-red-50 text-red-600' : 'bg-ink-50 text-ink-500'"
            >
              {{ item.dias_restantes }} {{ item.dias_restantes === 1 ? 'dia' : 'dias' }}
            </span>
          </div>

          <div class="mt-3 flex justify-end gap-1 border-t border-ink-100/70 pt-3">
            <button
              type="button"
              class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-600 transition-colors active:bg-brand-50"
              :disabled="restaurandoId === item.id"
              @click="restaurar(item)"
            >
              <RotateCcw :size="14" />
              {{ restaurandoId === item.id ? 'Restaurando...' : 'Restaurar' }}
            </button>
            <button
              type="button"
              class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors active:bg-red-50"
              :disabled="excluindoId === item.id"
              @click="askExcluir(item)"
            >
              <X :size="14" />
              Excluir
            </button>
          </div>
        </div>
      </div>

      <!-- sm and up: full table -->
      <div class="hidden overflow-hidden rounded-2xl border border-ink-100/70 bg-white shadow-sm shadow-ink-900/[0.03] sm:block">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-ink-50/60">
              <tr>
                <th class="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Item</th>
                <th class="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Tipo</th>
                <th class="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Excluído em</th>
                <th class="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Restam</th>
                <th class="px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider text-ink-400">Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-ink-100/60">
              <tr
                v-for="item in itens ?? []"
                :key="item.id"
                class="group text-ink-700 transition-colors hover:bg-ink-50/50"
              >
                <td class="px-5 py-3.5">
                  <div class="flex items-center gap-3">
                    <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                      <component :is="iconeFor(item.tabela_origem)" :size="15" />
                    </div>
                    <span class="font-medium text-ink-900">{{ nomeDoRegistro(item) }}</span>
                  </div>
                </td>
                <td class="px-5 py-3.5">
                  <span class="rounded-full px-2 py-0.5 text-xs font-semibold" :class="badgeClassFor(item.tabela_origem)">
                    {{ nomeFor(item.tabela_origem) }}
                  </span>
                </td>
                <td class="px-5 py-3.5 text-ink-500">{{ formatarData(item.excluido_em) }}</td>
                <td class="px-5 py-3.5">
                  <span
                    class="rounded-full px-2 py-0.5 text-xs font-medium"
                    :class="item.dias_restantes <= 2 ? 'bg-red-50 text-red-600' : 'bg-ink-50 text-ink-500'"
                  >
                    {{ item.dias_restantes }} {{ item.dias_restantes === 1 ? 'dia' : 'dias' }}
                  </span>
                </td>
                <td class="px-5 py-3.5">
                  <div class="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <button
                      type="button"
                      class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50"
                      :disabled="restaurandoId === item.id"
                      @click="restaurar(item)"
                    >
                      <RotateCcw :size="14" />
                      {{ restaurandoId === item.id ? 'Restaurando...' : 'Restaurar' }}
                    </button>
                    <button
                      type="button"
                      class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                      :disabled="excluindoId === item.id"
                      @click="askExcluir(item)"
                    >
                      <X :size="14" />
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Paginação — mesmo padrão do DataTable.vue -->
      <div
        v-if="hasPagination"
        class="mt-4 flex flex-col items-center justify-between gap-3 border-t border-ink-100 pt-3 sm:flex-row"
      >
        <p class="text-xs text-ink-400">{{ rangeLabel }}</p>

        <div class="flex items-center gap-1">
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            :disabled="currentPage <= 1 || isLoading"
            aria-label="Página anterior"
            @click="irParaPagina(currentPage - 1)"
          >
            <ChevronLeft :size="15" />
          </button>

          <template v-for="(page, idx) in visiblePages" :key="`${page}-${idx}`">
            <span v-if="page === '...'" class="px-1.5 text-xs text-ink-300">…</span>
            <button
              v-else
              type="button"
              class="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              :class="page === currentPage ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-ink-50'"
              :disabled="isLoading"
              :aria-current="page === currentPage ? 'page' : undefined"
              @click="irParaPagina(page)"
            >
              {{ page }}
            </button>
          </template>

          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            :disabled="currentPage >= lastPage || isLoading"
            aria-label="Próxima página"
            @click="irParaPagina(currentPage + 1)"
          >
            <ChevronRight :size="15" />
          </button>
        </div>
      </div>
    </template>

    <ConfirmModal
      v-if="isConfirmOpen"
      title="Excluir permanentemente"
      :message="`Tem certeza que deseja excluir ${nomeDoRegistro(itemParaExcluir)} permanentemente? Essa ação não pode ser desfeita.`"
      confirm-label="Excluir"
      :is-loading="excluindoId === itemParaExcluir?.id"
      @close="closeConfirm"
      @confirm="confirmarExclusao"
    />
  </AppShell>
</template>