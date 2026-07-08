<script setup>
import { useId } from 'vue'

defineProps({
  modelValue: { type: Boolean, default: false },
  label: { type: String, required: true },
})

defineEmits(['update:modelValue'])

const checkboxId = useId()
</script>

<template>
  <label :for="checkboxId" class="flex cursor-pointer select-none items-center gap-2 text-sm text-ink-700">
    <input
      :id="checkboxId"
      type="checkbox"
      :checked="modelValue"
      class="h-4 w-4 rounded border-surface-border text-brand-500 accent-brand-500 focus:ring-2 focus:ring-brand-500/30"
      @change="$emit('update:modelValue', $event.target.checked)"
    />
    {{ label }}
  </label>
</template>
