<script setup>
import { AlertTriangle } from '@lucide/vue'
import BaseModal from './BaseModal.vue'
import BaseButton from './BaseButton.vue'

defineProps({
  title: { type: String, default: 'Confirmar ação' },
  message: { type: String, required: true },
  confirmLabel: { type: String, default: 'Confirmar' },
  cancelLabel: { type: String, default: 'Cancelar' },
  isLoading: { type: Boolean, default: false },
})

const emit = defineEmits(['confirm', 'close'])
</script>

<template>
  <BaseModal :title="title" @close="emit('close')">
    <div class="flex flex-col gap-4">
      <div class="flex items-start gap-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertTriangle :size="20" />
        </div>
        <p class="pt-2 text-sm text-ink-600">{{ message }}</p>
      </div>

      <div class="mt-2 flex justify-end gap-3">
        <BaseButton type="button" variant="ghost" :disabled="isLoading" @click="emit('close')">
          {{ cancelLabel }}
        </BaseButton>
        <button
          type="button"
          class="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="isLoading"
          @click="emit('confirm')"
        >
          {{ isLoading ? 'Removendo...' : confirmLabel }}
        </button>
      </div>
    </div>
  </BaseModal>
</template>