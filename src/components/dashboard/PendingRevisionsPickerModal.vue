<script setup>
import { Calendar, TrendingUp, FileText, ChevronRight } from '@lucide/vue'
import BaseModal from '../ui/BaseModal.vue'

defineProps({
  vehicleLabel: { type: String, required: true },
  personName: { type: String, default: '' },
  // cada item: { key, dateLabel, kmLabel, originLabel, description, payload }
  predictions: { type: Array, required: true },
})

const emit = defineEmits(['select', 'close'])

// 🔧 CORRIGIDO — antes as opções deste modal podiam aparecer todas com o
// mesmo rótulo "Agendada", sem nenhuma pista visual do que o usuário
// estava escolhendo (só a presença/ausência de km diferenciava). Agora
// cada tipo de previsão (agendada / estimada / informada) ganha um
// ícone, uma cor de fundo e um "chip" de rótulo próprios, deduzidos a
// partir do `originLabel` que já vem calculado em quem abre este modal
// (UpcomingRevisionsCard.vue e UpcomingRevisionsPanel.vue).
const KIND_STYLE = {
  scheduled: {
    icon: Calendar,
    iconBg: 'bg-amber-50 text-amber-600',
    chip: 'bg-amber-100 text-amber-700',
    chipLabel: 'Agendada',
  },
  estimated: {
    icon: TrendingUp,
    iconBg: 'bg-brand-50 text-brand-600',
    chip: 'bg-brand-100 text-brand-700',
    chipLabel: 'Estimada',
  },
  informed: {
    icon: FileText,
    iconBg: 'bg-emerald-50 text-emerald-600',
    chip: 'bg-emerald-100 text-emerald-700',
    chipLabel: 'Informada',
  },
}

const resolveKind = (originLabel) => {
  const normalized = (originLabel || '').toLowerCase()
  if (normalized.startsWith('agendada')) return 'scheduled'
  if (normalized.startsWith('estimad')) return 'estimated'
  return 'informed'
}

const styleFor = (originLabel) => KIND_STYLE[resolveKind(originLabel)]

// 🔧 CORRIGIDO — no endpoint /reports/revisions/upcoming (ver
// ReportController::upcomingRevisions no backend), o campo `description`
// tem origem DIFERENTE dependendo do tipo da previsão:
//
// - is_scheduled = true  (kind "scheduled"/"Agendada"): a revisão futura
//   JÁ FOI criada de fato, então `description` é a descrição própria dela.
// - is_scheduled = false (kind "estimated"/"informed" — "Estimada" ou
//   "Informada"): a revisão futura AINDA NÃO foi criada; `description`
//   vem da ÚLTIMA revisão já realizada (a que originou essa previsão por
//   recorrência), não de uma descrição própria — porque ela não existe.
//
// Ou seja: não existe um campo separado pra "nome da revisão anterior" —
// o próprio `item.description`, nesses dois casos, JÁ É a descrição da
// revisão anterior. Só precisamos deixar isso explícito no texto.
const descriptionFor = (item) => {
  const rawDescription = item?.description ?? item?.payload?.description ?? null

  if (!rawDescription) return null

  const kind = resolveKind(item.originLabel)

  // Revisão já criada (agendada de fato): mostra a descrição normalmente
  if (kind === 'scheduled') return rawDescription

  // Ainda não criada (estimada/informada): deixa claro que é a descrição
  // da revisão anterior, não da que está sendo prevista
  return `Revisão anterior: ${rawDescription}`
}
</script>

<template>
  <BaseModal title="Selecione a revisão" @close="emit('close')">
    <div class="flex flex-col gap-1">
      <div class="mb-3">
        <p class="text-sm font-semibold text-ink-900">{{ vehicleLabel }}</p>
        <p v-if="personName" class="text-xs text-ink-500">{{ personName }}</p>
      </div>

      <p class="mb-2 text-xs text-ink-500">
        Este veículo tem {{ predictions.length }} revisões pendentes. Escolha qual deseja iniciar:
      </p>

      <ul class="flex flex-col divide-y divide-ink-100">
        <li
          v-for="item in predictions"
          :key="item.key"
          role="button"
          tabindex="0"
          class="flex cursor-pointer items-center justify-between gap-3 rounded-lg py-3 px-2 -mx-2 transition-colors hover:bg-ink-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
          @click="emit('select', item)"
          @keydown.enter="emit('select', item)"
        >
          <div class="flex min-w-0 items-center gap-3">
            <span
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              :class="styleFor(item.originLabel).iconBg"
            >
              <component :is="styleFor(item.originLabel).icon" :size="16" />
            </span>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <p class="truncate text-sm font-medium text-ink-900">{{ item.dateLabel }}</p>
                <span
                  class="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                  :class="styleFor(item.originLabel).chip"
                >
                  {{ styleFor(item.originLabel).chipLabel }}
                </span>
              </div>
              <p class="truncate text-xs text-ink-500">
                {{ item.originLabel }}
                <span v-if="item.kmLabel"> · {{ item.kmLabel }}</span>
              </p>
              <p
                class="mt-0.5 truncate text-xs"
                :class="descriptionFor(item) ? 'text-ink-500' : 'text-ink-300 italic'"
              >
                {{ descriptionFor(item) || 'Sem descrição ainda' }}
              </p>
            </div>
          </div>

          <ChevronRight :size="16" class="shrink-0 text-ink-300" />
        </li>
      </ul>
    </div>
  </BaseModal>
</template>