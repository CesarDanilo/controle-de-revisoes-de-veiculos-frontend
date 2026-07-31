<script setup>
import { computed, useId } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, required: true },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '' },
  autocomplete: { type: String, default: 'off' },
  icon: { type: [Object, Function], default: null },
  required: { type: Boolean, default: false }, // 🔴 AQUI — exibe asterisco vermelho no label
  error: { type: Boolean, default: false }, // 🔴 AQUI — aplica borda vermelha quando o campo está inválido
})

const emit = defineEmits(['update:modelValue', 'blur']) // 🔴 AQUI — 'blur' agora é evento próprio do componente

const inputId = useId()

const onInput = (event) => emit('update:modelValue', event.target.value)
const onBlur = (event) => emit('blur', event) // 🔴 AQUI — disparado direto do <input>, não da div wrapper

const iconComponent = computed(() => props.icon)
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label :for="inputId" class="text-sm font-medium text-ink-700">
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
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
        :required="required"
        class="w-full rounded-xl border bg-white py-2.5 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-400"
        :class="[
          iconComponent ? 'pl-10 pr-3.5' : 'px-3.5',
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
            : 'border-surface-border focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10',
        ]"
        @input="onInput"
        @blur="onBlur"
      />

      <slot name="trailing" />
    </div>
  </div>
</template>