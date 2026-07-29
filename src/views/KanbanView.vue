<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { Clock, FileText, GripVertical, Pencil, Plus, Search, X } from '@lucide/vue'
import AppShell from '../components/layout/AppShell.vue'
import BaseButton from '../components/ui/BaseButton.vue'
// mesmo modal já usado em Pessoas e Relatórios
import RevisionsModal from '../components/people/RevisionsModal.vue'
import { revisionService } from '../services/revision.service'
import { useToast } from '../composables/useToast'

const toast = useToast()
const queryClient = useQueryClient()

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Aproximação — mostra "desde quando esse registro foi tocado pela
// última vez" usando updated_at, porque ainda não temos a tabela de
// histórico (revision_status_logs) pra saber exatamente quando ele ENTROU
// na etapa atual. Se/quando essa tabela existir, troque a fonte aqui.
const tempoDesdeAtualizacao = (isoDate) => {
  if (!isoDate) return ''
  const dias = Math.floor((new Date() - new Date(isoDate)) / (1000 * 60 * 60 * 24))
  if (dias <= 0) return 'atualizado hoje'
  if (dias === 1) return 'atualizado há 1 dia'
  return `atualizado há ${dias} dias`
}

// Removido o "limite" por coluna. Agora cada coluna tem altura fixa e
// rolagem vertical própria (ver o container dos cards no template), então
// não há mais motivo pra travar a quantidade de cards.
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
// Busca real via API (GET /revisions)
// ---------------------------------------------------------------------------
const {
  data: revisoes,
  isLoading,
  error,
} = useQuery({
  queryKey: ['revisions-kanban'],
  queryFn: () => revisionService.list(),
})

watch(error, (err) => {
  if (err) toast.error(err.response?.data?.message ?? 'Não foi possível carregar as revisões.')
})

// ---------------------------------------------------------------------------
// Filtro por nome (da pessoa) — mesmo padrão de limite/contador da tela
// de Proprietários (maxlength + truncamento em JS + contador "fantasma")
// ---------------------------------------------------------------------------
const NAME_FILTER_MAX_LENGTH = 40

const filtroNome = ref('')

const sanitizeNameFilter = () => {
  if (filtroNome.value.length > NAME_FILTER_MAX_LENGTH) {
    filtroNome.value = filtroNome.value.slice(0, NAME_FILTER_MAX_LENGTH)
  }
}

// normaliza removendo acentos, pra "joao" encontrar "João"
const normalizar = (texto) =>
  (texto || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const revisoesFiltradas = computed(() => {
  const lista = revisoes.value ?? []
  const termo = normalizar(filtroNome.value)
  if (!termo) return lista
  return lista.filter((r) => normalizar(r.person_name).includes(termo))
})

const limparFiltro = () => {
  filtroNome.value = ''
}

// Um array reativo por coluna — reconstruído sempre que a query trouxer
// dados novos, ou quando o filtro de nome mudar (ou depois de um rollback
// de drag-and-drop).
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

// Total de cards visíveis com o filtro aplicado (pra feedback no chip)
const totalFiltrado = computed(() =>
  COLUNAS.reduce((soma, { status }) => soma + colunasData[status].length, 0),
)

// ---------------------------------------------------------------------------
// Drag-and-drop nativo (HTML5) + persistência real via PATCH
// ---------------------------------------------------------------------------
const cardArrastado = ref(null) // { card, statusOrigem }
const colunaEmHover = ref(null) // status da coluna sob o cursor (feedback visual)

const onDragStart = (card, statusOrigem) => {
  cardArrastado.value = { card, statusOrigem }
}

const onDragOverColuna = (status) => {
  colunaEmHover.value = status
}

const onDragLeaveColuna = (status) => {
  if (colunaEmHover.value === status) colunaEmHover.value = null
}

const onDrop = async (statusDestino) => {
  colunaEmHover.value = null
  if (!cardArrastado.value) return

  const { card, statusOrigem } = cardArrastado.value
  cardArrastado.value = null
  if (statusOrigem === statusDestino) return

  // update otimista: move o card na hora, sem esperar a API responder
  colunasData[statusOrigem] = colunasData[statusOrigem].filter((c) => c.id !== card.id)
  card.status = statusDestino
  colunasData[statusDestino].push(card)

  try {
    await revisionService.updateStatus(card.id, statusDestino)
  } catch (err) {
    // desfaz o movimento se a API recusar (rede caiu, 422, 500 etc.)
    toast.error('Não foi possível mover a revisão. Tente novamente.')
    colunasData[statusDestino] = colunasData[statusDestino].filter((c) => c.id !== card.id)
    card.status = statusOrigem
    colunasData[statusOrigem].push(card)
  }
}

// ---------------------------------------------------------------------------
// Modal de revisões, aberto pelo ícone de edição do card. Mesmo padrão
// usado em Relatórios (handleRevisionsByPeriodRowClick): abre o
// RevisionsModal já filtrado na pessoa dona do veículo, com o veículo e a
// revisão certos destacados/em edição.
// ---------------------------------------------------------------------------
const isRevisionsModalOpen = ref(false)
const selectedPerson = ref(null)
const highlightVehicleId = ref(null)
const highlightRevisionId = ref(null)

const openRevisionsModal = (card) => {
  // sem person_id não dá pra abrir o modal (ex: veículo sem dono cadastrado)
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
  // recarrega o board pra refletir qualquer edição feita dentro do modal
  // (ex: status/status_pagamento mudados manualmente, não via drag-and-drop)
  queryClient.invalidateQueries({ queryKey: ['revisions-kanban'] })
}
</script>

<template>
  <AppShell title="Kanban de Revisões" subtitle="Acompanhe o andamento de cada revisão por etapa.">
    <template #actions>
      <router-link to="/revisoes">
        <BaseButton variant="outline">Ver em lista</BaseButton>
      </router-link>
      <BaseButton variant="primary">
        <Plus :size="16" />
        Nova revisão
      </BaseButton>
    </template>

    <!-- Filtro por nome — mesmo cartão/inputs/contador/chip da tela de
         Proprietários -->
    <div class="mb-4 rounded-2xl border border-ink-100/70 bg-white p-4 shadow-sm shadow-ink-900/[0.03]">
      <div class="relative max-w-xs">
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

      <!-- chip de filtro ativo, no mesmo padrão da tela de Proprietários -->
      <div v-if="filtroNome" class="mt-3 flex flex-wrap items-center gap-2">
        <span class="text-xs text-ink-500">{{ totalFiltrado }} encontrada(s):</span>

        <span
          class="inline-flex items-center gap-1.5 rounded-full bg-brand-50 py-1 pl-3 pr-1.5 text-xs font-medium text-brand-700"
        >
          <span class="text-brand-500">Nome:</span>
          {{ filtroNome }}
          <button
            type="button"
            class="flex h-4 w-4 items-center justify-center rounded-full text-brand-500 transition-colors hover:bg-brand-200 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            aria-label="Remover filtro de nome"
            @click="limparFiltro"
          >
            <X :size="11" />
          </button>
        </span>
      </div>
    </div>

    <p v-if="isLoading" class="text-sm text-ink-400">Carregando revisões...</p>

    <!-- items-start pra cada coluna ter sua própria altura fixa (h-full só
         funcionaria se o pai tivesse altura definida; com items-start +
         max-h nos filhos, cada coluna cresce até o teto e depois rola por
         conta própria, sem depender da altura das vizinhas) -->
    <section v-else class="flex items-start gap-4 overflow-x-auto pb-2">
      <div
        v-for="coluna in COLUNAS"
        :key="coluna.status"
        class="flex w-[280px] flex-shrink-0 flex-col rounded-2xl border border-ink-100/70 bg-ink-50/60 shadow-sm shadow-ink-900/[0.03]"
      >
        <!-- Cabeçalho da coluna -->
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

        <!-- Lista de cards (área de drop) — rola verticalmente, sem limite
             de quantidade. max-h define o "teto" de cada coluna; ajuste o
             valor se quiser colunas mais altas/baixas. -->
        <div
          class="flex max-h-[65vh] min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto rounded-b-2xl p-3 transition-colors"
          :class="colunaEmHover === coluna.status ? 'bg-brand-50/60' : ''"
          @dragover.prevent="onDragOverColuna(coluna.status)"
          @dragleave="onDragLeaveColuna(coluna.status)"
          @drop.prevent="onDrop(coluna.status)"
        >
          <div
            v-for="card in colunasData[coluna.status]"
            :key="card.id"
            draggable="true"
            class="group cursor-grab rounded-xl border border-ink-100/70 bg-white p-3 shadow-sm shadow-ink-900/[0.03] transition-colors hover:border-brand-200 active:cursor-grabbing"
            @dragstart="onDragStart(card, coluna.status)"
          >
            <div class="mb-2 flex items-start justify-between gap-2">
              <div class="flex items-center gap-1.5 text-sm font-medium text-ink-900">
                <FileText :size="14" class="shrink-0 text-ink-300" />
                {{ card.description }}
              </div>
              <div class="flex shrink-0 items-center gap-0.5">
                <!-- abre o RevisionsModal já em modo edição desta revisão.
                     @click.stop pra não conflitar com o drag do card. -->
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

            <!-- person_name/vehicle_model/vehicle_license_plate vindos do
                 backend (eager load vehicle.people) -->
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
                :class="PAGAMENTO_BADGE[card.status_pagamento].classes"
              >
                {{ PAGAMENTO_BADGE[card.status_pagamento].label }}
              </span>
            </div>

            <div class="mt-2 flex items-center gap-1 text-xs text-ink-400">
              <Clock :size="12" />
              {{ tempoDesdeAtualizacao(card.updated_at) }}
            </div>
          </div>

          <!-- Estado vazio da coluna -->
          <p
            v-if="colunasData[coluna.status].length === 0"
            class="rounded-xl border border-dashed border-ink-100 p-4 text-center text-xs text-ink-400"
          >
            {{ filtroNome ? 'Nenhum resultado para esse filtro' : 'Arraste um card para cá' }}
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