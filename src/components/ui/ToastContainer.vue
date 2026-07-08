<script setup>
import { CheckCircle2, XCircle, Info, X } from '@lucide/vue'
import { useToast } from '../../composables/useToast'

const { toasts, remove } = useToast()

const iconByType = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
}

const stylesByType = {
  success: 'border-green-100 bg-green-50 text-green-700',
  error: 'border-red-100 bg-red-50 text-red-700',
  info: 'border-brand-100 bg-brand-50 text-brand-700',
}

const iconStylesByType = {
  success: 'text-green-600',
  error: 'text-red-600',
  info: 'text-brand-600',
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-6 right-6 z-[100] flex w-full max-w-sm flex-col gap-3">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="flex items-start gap-3 rounded-2xl border p-4 shadow-lg"
          :class="stylesByType[toast.type]"
        >
          <component
            :is="iconByType[toast.type]"
            :size="20"
            class="mt-0.5 shrink-0"
            :class="iconStylesByType[toast.type]"
          />
          <p class="flex-1 text-sm font-medium">{{ toast.message }}</p>
          <button
            type="button"
            class="shrink-0 opacity-60 transition-opacity hover:opacity-100"
            aria-label="Fechar"
            @click="remove(toast.id)"
          >
            <X :size="16" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(30px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>