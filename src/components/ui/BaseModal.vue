<script setup>
import { X } from '@lucide/vue'

const props = defineProps({
  title: { type: String, required: true },
  size: { type: String, default: 'md' },
})

const emit = defineEmits(['close'])

const sizeClasses = {
  md: 'max-w-md',
  xl: 'max-w-3xl',
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        class="absolute inset-0 bg-ink-900/40 backdrop-blur-sm"
        @click="emit('close')"
      />

      <div
        class="relative w-full rounded-2xl bg-white p-6 shadow-xl"
        :class="sizeClasses[size] ?? sizeClasses.md"
      >
        <div class="mb-5 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-ink-900">{{ title }}</h2>
          <button
            type="button"
            class="text-ink-400 transition-colors hover:text-ink-700"
            aria-label="Fechar"
            @click="emit('close')"
          >
            <X :size="20" />
          </button>
        </div>

        <slot />
      </div>
    </div>
  </Teleport>
</template>