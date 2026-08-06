<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { Calendar, Clock, FileText, GripVertical, IdCard, Pencil, RefreshCw, Search, X, CheckCircle2 } from '@lucide/vue'
import AppShell from '../components/layout/AppShell.vue'
import RevisionsModal from '../components/people/RevisionsModal.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import { revisionService } from '../services/revision.service'
import { useToast } from '../composables/useToast'

const toast = useToast()
const queryClient = useQueryClient()

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const tempoDesdeAtualizacao = (isoDate) => {
  if (!isoDate) return ''
  const dias = Math.floor((new Date() - new Date(isoDate)) / (1000 * 60 * 60 * 24))
  if (dias <= 0) return 'atualizado hoje'
  if (dias === 1) return 'atualizado há 1 dia'
  return `atualizado há ${dias} dias`
}

const COLUNAS = [
  { status: 'aberto', titulo: 'Aberto', cor: 'bg-ink-300' },
  { status: 'em_andamento', titulo: 'Em andamento', cor: 'bg-amber-400' },
  { status: 'aguardando_pagamento', titulo: 'Aguardando pagamento', cor: 'bg-sky-400' },
  { status: 'concluido', titulo: 'Concluído', cor: 'bg-emerald-400' },
  { status: 'cancelado', titulo: 'Cancelado', cor: 'bg-red-400' },
]

const PAGAMENTO_BADGE = {
  pago: { label: 'Pago', classes: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  pendente: { label: 'Pendente', classes: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
}

// ---------------------------------------------------------------------------
// Busca real via API
// ---------------------------------------------------------------------------
const {
  data: revisoes,
  isLoading,
  error,
  refetch,
} = useQuery({
  queryKey: ['revisions-kanban'],
  queryFn: () => revisionService.list(),
})

watch(error, (err) => {
  if (err) toast.error(err.response?.data?.message ?? 'Não foi possível carregar as revisões.')
})

const isRefreshing = ref(false)

const refreshRevisoes = async () => {
  if (isRefreshing.value) return
  isRefreshing.value = true
  try {
    await refetch()
    toast.success('Dados atualizados!')
  } catch (err) {
    toast.error('Não foi possível atualizar os dados.')
  } finally {
    isRefreshing.value = false
  }
}

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------
const NAME_FILTER_MAX_LENGTH = 40
const DESCRICAO_FILTER_MAX_LENGTH = 60
const PLACA_FILTER_MAX_LENGTH = 8

const filtroNome = ref('')
const filtroDescricao = ref('')
const filtroPlaca = ref('')
const filtroDataDe = ref('')
const filtroDataAte = ref('')

const sanitizeNameFilter = () => {
  if (filtroNome.value.length > NAME_FILTER_MAX_LENGTH) {
    filtroNome.value = filtroNome.value.slice(0, NAME_FILTER_MAX_LENGTH)
  }
}

const sanitizeDescricaoFilter = () => {
  if (filtroDescricao.value.length > DESCRICAO_FILTER_MAX_LENGTH) {
    filtroDescricao.value = filtroDescricao.value.slice(0, DESCRICAO_FILTER_MAX_LENGTH)
  }
}

const sanitizePlacaFilter = () => {
  if (filtroPlaca.value.length > PLACA_FILTER_MAX_LENGTH) {
    filtroPlaca.value = filtroPlaca.value.slice(0, PLACA_FILTER_MAX_LENGTH)
  }
  filtroPlaca.value = filtroPlaca.value.toUpperCase()
}

const normalizar = (texto) =>
  (texto || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const normalizarPlaca = (placa) =>
  (placa || '')
    .toString()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

const revisoesFiltradas = computed(() => {
  const lista = revisoes.value ?? []

  const termoNome = normalizar(filtroNome.value)
  const termoDescricao = normalizar(filtroDescricao.value)
  const termoPlaca = normalizarPlaca(filtroPlaca.value)

  const dataDe = filtroDataDe.value ? new Date(`${filtroDataDe.value}T00:00:00`) : null
  const dataAte = filtroDataAte.value ? new Date(`${filtroDataAte.value}T23:59:59`) : null

  return lista.filter((r) => {
    if (termoNome && !normalizar(r.person_name).includes(termoNome)) return false
    if (termoDescricao && !normalizar(r.description).includes(termoDescricao)) return false
    if (termoPlaca && !normalizarPlaca(r.vehicle_license_plate).includes(termoPlaca)) return false

    if (dataDe || dataAte) {
      const dataRevisao = new Date(r.revision_date)
      if (dataDe && dataRevisao < dataDe) return false
      if (dataAte && dataRevisao > dataAte) return false
    }

    return true
  })
})

const limparFiltroNome = () => { filtroNome.value = '' }
const limparFiltroDescricao = () => { filtroDescricao.value = '' }
const limparFiltroPlaca = () => { filtroPlaca.value = '' }
const limparFiltroData = () => {
  filtroDataDe.value = ''
  filtroDataAte.value = ''
}

const filtrosAtivos = computed(() => {
  const chips = []
  if (filtroNome.value) chips.push({ key: 'nome', label: 'Nome', valor: filtroNome.value, limpar: limparFiltroNome })
  if (filtroDescricao.value) chips.push({ key: 'descricao', label: 'Descrição', valor: filtroDescricao.value, limpar: limparFiltroDescricao })
  if (filtroPlaca.value) chips.push({ key: 'placa', label: 'Placa', valor: filtroPlaca.value, limpar: limparFiltroPlaca })
  if (filtroDataDe.value || filtroDataAte.value) {
    const de = filtroDataDe.value ? new Date(`${filtroDataDe.value}T00:00:00`).toLocaleDateString('pt-BR') : '...'
    const ate = filtroDataAte.value ? new Date(`${filtroDataAte.value}T00:00:00`).toLocaleDateString('pt-BR') : '...'
    chips.push({ key: 'data', label: 'Período', valor: `${de} – ${ate}`, limpar: limparFiltroData })
  }
  return chips
})

const algumFiltroAtivo = computed(() => filtrosAtivos.value.length > 0)

const colunasData = reactive(Object.fromEntries(COLUNAS.map(({ status }) => [status, []])))

watch(
  revisoesFiltradas,
  (lista) => {
    if (!lista) return
    COLUNAS.forEach(({ status }) => {
      colunasData[status] = lista.filter((r) => r.status === status)
    })
  },
  { immediate: true },
)

const valorTotalColuna = (status) =>
  formatCurrency(colunasData[status].reduce((soma, r) => soma + Number(r.cost || 0), 0))

const totalFiltrado = computed(() =>
  COLUNAS.reduce((soma, { status }) => soma + colunasData[status].length, 0),
)

// ---------------------------------------------------------------------------
// Drag-and-drop otimizado sem travamentos
// ---------------------------------------------------------------------------
const cardArrastado = ref(null)
const colunaEmHover = ref(null)
const lastMovedCardId = ref(null)
let highlightTimeout = null

const onDragStart = (card, statusOrigem) => {
  cardArrastado.value = { card, statusOrigem }
}

const onDragEnd = () => {
  cardArrastado.value = null
  colunaEmHover.value = null
}

// Otimização: evita re-renders excessivos durante o arrasto continuo do mouse
const onDragOverColuna = (status) => {
  if (colunaEmHover.value !== status) {
    colunaEmHover.value = status
  }
}

const onDragLeaveColuna = (status) => {
  if (colunaEmHover.value === status) {
    colunaEmHover.value = null
  }
}

const onDrop = async (statusDestino) => {
  colunaEmHover.value = null
  if (!cardArrastado.value) return

  const { card, statusOrigem } = cardArrastado.value
  cardArrastado.value = null
  if (statusOrigem === statusDestino) return

  // 1. Remove da coluna de origem
  colunasData[statusOrigem] = colunasData[statusOrigem].filter((c) => c.id !== card.id)
  card.status = statusDestino

  // 2. Coloca SEMPRE no topo da coluna de destino, não importa onde foi solto
  colunasData[statusDestino].unshift(card)

  // 3. Destaque temporário de 3s
  lastMovedCardId.value = card.id
  if (highlightTimeout) clearTimeout(highlightTimeout)
  highlightTimeout = setTimeout(() => {
    lastMovedCardId.value = null
  }, 3000)

  try {
    await revisionService.updateStatus(card.id, statusDestino)
  } catch (err) {
    toast.error('Não foi possível mover a revisão. Tente novamente.')
    colunasData[statusDestino] = colunasData[statusDestino].filter((c) => c.id !== card.id)
    card.status = statusOrigem
    colunasData[statusOrigem].push(card)
    lastMovedCardId.value = null
  }
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------
const isRevisionsModalOpen = ref(false)
const selectedPerson = ref(null)
const highlightVehicleId = ref(null)
const highlightRevisionId = ref(null)

const openRevisionsModal = (card) => {
  if (!card.person_id) {
    toast.error('Essa revisão não tem um proprietário vinculado.')
    return
  }
  selectedPerson.value = { id: card.person_id, name: card.person_name }
  highlightVehicleId.value = card.vehicle_id
  highlightRevisionId.value = card.id
  isRevisionsModalOpen.value = true
}

const closeRevisionsModal = () => {
  isRevisionsModalOpen.value = false
  selectedPerson.value = null
  highlightVehicleId.value = null
  highlightRevisionId.value = null
  queryClient.invalidateQueries({ queryKey: ['revisions-kanban'] })
}
</script>

<template>
  <AppShell title="Kanban de Revisões" subtitle="Acompanhe o andamento de cada revisão por etapa.">
    <template #actions>
      <BaseButton
        variant="secondary"
        :disabled="isRefreshing"
        class="flex items-center justify-center gap-2 cursor-pointer bg-brand-600 hover:bg-brand-500 text-white"
        @click="refreshRevisoes"
      >
        <RefreshCw :size="16" :class="isRefreshing ? 'animate-spin' : ''" />
        {{ isRefreshing ? 'Atualizando...' : 'Atualizar' }}
      </BaseButton>
    </template>

    <div class="mb-4 rounded-2xl border border-ink-100/70 bg-white p-4 shadow-sm shadow-ink-900/[0.03]">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div class="relative">
          <Search :size="14" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            v-model="filtroNome"
            type="text"
            placeholder="Filtrar por nome do proprietário"
            :maxlength="NAME_FILTER_MAX_LENGTH"
            class="w-full rounded-xl border border-ink-100 py-2 pl-9 pr-14 text-sm text-ink-700 placeholder:text-ink-300 focus:border-brand-400 focus:outline-none"
            @input="sanitizeNameFilter"
          />
          <span
            class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium tabular-nums"
            :class="filtroNome.length >= NAME_FILTER_MAX_LENGTH ? 'text-amber-500' : 'text-ink-300'"
          >
            {{ filtroNome.length }}/{{ NAME_FILTER_MAX_LENGTH }}
          </span>
        </div>

        <div class="relative">
          <FileText :size="14" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            v-model="filtroDescricao"
            type="text"
            placeholder="Filtrar por descrição"
            :maxlength="DESCRICAO_FILTER_MAX_LENGTH"
            class="w-full rounded-xl border border-ink-100 py-2 pl-9 pr-14 text-sm text-ink-700 placeholder:text-ink-300 focus:border-brand-400 focus:outline-none"
            @input="sanitizeDescricaoFilter"
          />
          <span
            class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium tabular-nums"
            :class="filtroDescricao.length >= DESCRICAO_FILTER_MAX_LENGTH ? 'text-amber-500' : 'text-ink-300'"
          >
            {{ filtroDescricao.length }}/{{ DESCRICAO_FILTER_MAX_LENGTH }}
          </span>
        </div>

        <div class="relative">
          <IdCard :size="14" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            v-model="filtroPlaca"
            type="text"
            placeholder="ABC1234"
            :maxlength="PLACA_FILTER_MAX_LENGTH"
            class="w-full rounded-xl border border-ink-100 py-2 pl-9 pr-14 text-sm uppercase text-ink-700 placeholder:text-ink-300 placeholder:normal-case focus:border-brand-400 focus:outline-none"
            @input="sanitizePlacaFilter"
          />
          <span
            class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium tabular-nums"
            :class="filtroPlaca.length >= PLACA_FILTER_MAX_LENGTH ? 'text-amber-500' : 'text-ink-300'"
          >
            {{ filtroPlaca.length }}/{{ PLACA_FILTER_MAX_LENGTH }}
          </span>
        </div>

        <div class="flex items-center gap-2">
          <div class="relative flex-1">
            <Calendar :size="14" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
            <input
              v-model="filtroDataDe"
              type="date"
              aria-label="Data inicial"
              class="w-full rounded-xl border border-ink-100 py-2 pl-9 pr-2 text-sm text-ink-700 focus:border-brand-400 focus:outline-none"
            />
          </div>
          <span class="text-xs text-ink-300">até</span>
          <div class="relative flex-1">
            <Calendar :size="14" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
            <input
              v-model="filtroDataAte"
              type="date"
              aria-label="Data final"
              class="w-full rounded-xl border border-ink-100 py-2 pl-9 pr-2 text-sm text-ink-700 focus:border-brand-400 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div v-if="algumFiltroAtivo" class="mt-3 flex flex-wrap items-center gap-2">
        <span class="text-xs text-ink-500">{{ totalFiltrado }} encontrada(s):</span>

        <span
          v-for="chip in filtrosAtivos"
          :key="chip.key"
          class="inline-flex items-center gap-1.5 rounded-full bg-brand-50 py-1 pl-3 pr-1.5 text-xs font-medium text-brand-700"
        >
          <span class="text-brand-500">{{ chip.label }}:</span>
          {{ chip.valor }}
          <button
            type="button"
            class="flex h-4 w-4 items-center justify-center rounded-full text-brand-500 transition-colors hover:bg-brand-200 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            :aria-label="`Remover filtro de ${chip.label.toLowerCase()}`"
            @click="chip.limpar"
          >
            <X :size="11" />
          </button>
        </span>
      </div>
    </div>

    <p v-if="isLoading" class="text-sm text-ink-400">Carregando revisões...</p>

    <section v-else class="flex items-start gap-4 overflow-x-auto pb-2 select-none">
      <div
        v-for="coluna in COLUNAS"
        :key="coluna.status"
        class="flex w-[280px] flex-shrink-0 flex-col rounded-2xl border transition-colors duration-150"
        :class="[
          colunaEmHover === coluna.status
            ? 'border-2 border-dashed border-brand-400 bg-brand-50/80 ring-2 ring-brand-400/20'
            : 'border-ink-100/70 bg-ink-50/60 shadow-sm shadow-ink-900/[0.03]'
        ]"
        @dragover.prevent="onDragOverColuna(coluna.status)"
        @dragleave="onDragLeaveColuna(coluna.status)"
        @drop.prevent="onDrop(coluna.status)"
      >
        <div class="flex items-center justify-between rounded-t-2xl border-b border-ink-100 bg-white px-4 py-3">
          <div class="flex items-center gap-2">
            <span class="h-2.5 w-2.5 rounded-full" :class="coluna.cor" />
            <h3 class="text-sm font-semibold text-ink-900">{{ coluna.titulo }}</h3>
            <span class="rounded-full bg-ink-50 px-2 py-0.5 text-xs font-medium text-ink-400">
              {{ colunasData[coluna.status].length }}
            </span>
          </div>
          <span class="text-xs text-ink-400">{{ valorTotalColuna(coluna.status) }}</span>
        </div>

        <div class="flex max-h-[65vh] min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto rounded-b-2xl p-3">
          <div
            v-if="colunaEmHover === coluna.status && cardArrastado?.statusOrigem !== coluna.status"
            class="rounded-xl border-2 border-dashed border-brand-400 bg-brand-100/60 p-2 text-center text-xs font-semibold text-brand-700 pointer-events-none"
          >
            Soltar aqui (vai para o topo)
          </div>

          <div
            v-for="card in colunasData[coluna.status]"
            :key="card.id"
            draggable="true"
            class="group cursor-grab rounded-xl border p-3 shadow-sm transition-all duration-200 active:cursor-grabbing will-change-transform"
            :class="[
              cardArrastado?.card?.id === card.id
                ? 'opacity-30 scale-95 border-brand-300'
                : '',
              lastMovedCardId === card.id
                ? 'border-brand-500 bg-brand-50/90 ring-2 ring-brand-400/50 shadow-md scale-[1.01]'
                : 'border-ink-100/70 bg-white hover:border-brand-200 shadow-ink-900/[0.03]'
            ]"
            @dragstart="onDragStart(card, coluna.status)"
            @dragend="onDragEnd"
          >
            <div
              v-if="lastMovedCardId === card.id"
              class="mb-2 flex items-center gap-1 text-[11px] font-semibold text-brand-700 bg-brand-100/80 px-2 py-0.5 rounded-md w-max"
            >
              <CheckCircle2 :size="12" class="text-brand-600" />
              Movido agora (no topo)
            </div>

            <div class="mb-2 flex items-start justify-between gap-2">
              <div class="flex items-center gap-1.5 text-sm font-medium text-ink-900">
                <FileText :size="14" class="shrink-0 text-ink-300" />
                {{ card.description }}
              </div>
              <div class="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  title="Editar revisão"
                  class="rounded-lg p-1 text-ink-400 opacity-0 transition-colors hover:bg-ink-50 hover:text-brand-600 group-hover:opacity-100"
                  @click.stop="openRevisionsModal(card)"
                >
                  <Pencil :size="14" />
                </button>
                <GripVertical :size="16" class="shrink-0 text-ink-200 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </div>

            <div class="mb-2 text-xs text-ink-500">
              <span v-if="card.person_name">{{ card.person_name }} · </span>
              <span v-if="card.vehicle_model || card.vehicle_license_plate">
                {{ card.vehicle_model }} {{ card.vehicle_license_plate ? `· ${card.vehicle_license_plate}` : '' }}
              </span>
            </div>
            <div class="mb-2 text-xs text-ink-400">
              {{ Number(card.km).toLocaleString('pt-BR') }} km · revisado em
              {{ new Date(card.revision_date).toLocaleDateString('pt-BR') }}
            </div>

            <div class="flex items-center justify-between">
              <span class="text-sm font-semibold text-ink-900">{{ formatCurrency(card.cost) }}</span>
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
                :class="PAGAMENTO_BADGE[card.status_pagamento]?.classes"
              >
                {{ PAGAMENTO_BADGE[card.status_pagamento]?.label }}
              </span>
            </div>

            <div class="mt-2 flex items-center gap-1 text-xs text-ink-400">
              <Clock :size="12" />
              {{ tempoDesdeAtualizacao(card.updated_at) }}
            </div>
          </div>

          <p
            v-if="colunasData[coluna.status].length === 0 && colunaEmHover !== coluna.status"
            class="rounded-xl border border-dashed border-ink-100 p-4 text-center text-xs text-ink-400"
          >
            {{ algumFiltroAtivo ? 'Nenhum resultado para esses filtros' : 'Arraste um card para cá' }}
          </p>
        </div>
      </div>
    </section>

    <RevisionsModal
      v-if="isRevisionsModalOpen"
      :person="selectedPerson"
      :highlight-vehicle-id="highlightVehicleId"
      :highlight-revision-id="highlightRevisionId"
      @close="closeRevisionsModal"
      @register-vehicle="closeRevisionsModal"
    />
  </AppShell>
</template>