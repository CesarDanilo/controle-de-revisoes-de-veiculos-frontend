<script setup>
import { computed, useId } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, required: true },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '' },
  autocomplete: { type: String, default: 'off' },
  icon: { type: [Object, Function], default: null },
})

const emit = defineEmits(['update:modelValue'])

const inputId = useId()

const onInput = (event) => emit('update:modelValue', event.target.value)

const iconComponent = computed(() => props.icon)
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label :for="inputId" class="text-sm font-medium text-ink-700">
      {{ label }}
    </label>

    <div class="relative flex items-center">
      <component
        :is="iconComponent"
        v-if="iconComponent"
        :size="18"
        class="pointer-events-none absolute left-3.5 text-ink-400"
      />

      <input
        :id="inputId"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :autocomplete="autocomplete"
        class="w-full rounded-xl border border-surface-border bg-white py-2.5 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
        :class="iconComponent ? 'pl-10 pr-3.5' : 'px-3.5'"
        @input="onInput"
      />

      <slot name="trailing" />
    </div>
  </div>
</template>
