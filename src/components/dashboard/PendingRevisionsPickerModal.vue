<script setup>
import { Calendar, ChevronRight } from '@lucide/vue'
import BaseModal from '../ui/BaseModal.vue'

defineProps({
  vehicleLabel: { type: String, required: true },
  personName: { type: String, default: '' },
  // cada item: { key, dateLabel, kmLabel, originLabel, payload }
  predictions: { type: Array, required: true },
})

const emit = defineEmits(['select', 'close'])
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
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Calendar :size="16" />
            </span>
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-ink-900">{{ item.dateLabel }}</p>
              <p class="truncate text-xs text-ink-500">
                {{ item.originLabel }}
                <span v-if="item.kmLabel"> · {{ item.kmLabel }}</span>
              </p>
            </div>
          </div>

          <ChevronRight :size="16" class="shrink-0 text-ink-300" />
        </li>
      </ul>
    </div>
  </BaseModal>
</template>