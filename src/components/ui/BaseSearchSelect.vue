<script setup>
import { ref, computed, watch, nextTick, useId } from 'vue'
import { ChevronDown, Search, Check } from '@lucide/vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, required: true }, // [{ id, name }]
  placeholder: { type: String, default: 'Selecione' },
  loadingText: { type: String, default: 'Carregando...' },
  searchPlaceholder: { type: String, default: 'Pesquisar...' },
  emptyText: { type: String, default: 'Nenhum resultado encontrado.' },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)
const searchTerm = ref('')
const triggerRef = ref(null)
const searchInputRef = ref(null)
const rootRef = ref(null)
const listboxId = useId()

const selectedOption = computed(() =>
  props.options.find((option) => option.id === props.modelValue) ?? null
)

const filteredOptions = computed(() => {
  const term = searchTerm.value.trim().toLowerCase()
  if (!term) return props.options
  return props.options.filter((option) => option.name.toLowerCase().includes(term))
})

const isDisabled = computed(() => props.disabled || props.loading)

async function openDropdown() {
  if (isDisabled.value) return
  isOpen.value = true
  searchTerm.value = ''
  await nextTick()
  searchInputRef.value?.focus()
}

function closeDropdown() {
  isOpen.value = false
  searchTerm.value = ''
}

function toggleDropdown() {
  if (isOpen.value) {
    closeDropdown()
  } else {
    openDropdown()
  }
}

function selectOption(option) {
  emit('update:modelValue', option.id)
  closeDropdown()
  triggerRef.value?.focus()
}

function handleClickOutside(event) {
  if (rootRef.value && !rootRef.value.contains(event.target)) {
    closeDropdown()
  }
}

function handleEscape(event) {
  if (event.key === 'Escape') {
    closeDropdown()
    triggerRef.value?.focus()
  }
}

watch(isOpen, (open) => {
  if (open) {
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
  } else {
    document.removeEventListener('mousedown', handleClickOutside)
    document.removeEventListener('keydown', handleEscape)
  }
})
</script>

<template>
  <div ref="rootRef" class="relative">
    <button
      ref="triggerRef"
      type="button"
      class="flex w-full items-center justify-between gap-2 rounded-xl border border-surface-border bg-white px-3.5 py-2.5 text-left text-sm outline-none transition-colors focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
      :class="isDisabled ? 'cursor-not-allowed bg-ink-50 text-ink-400' : 'text-ink-900 hover:border-ink-300'"
      :disabled="isDisabled"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      @click="toggleDropdown"
    >
      <span class="truncate" :class="!selectedOption ? 'text-ink-400' : 'text-ink-900'">
        {{ loading ? loadingText : (selectedOption ? selectedOption.name : placeholder) }}
      </span>
      <ChevronDown
        :size="16"
        class="shrink-0 text-ink-400 transition-transform"
        :class="isOpen ? 'rotate-180' : ''"
      />
    </button>

    <div
      v-if="isOpen"
      class="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-surface-border bg-white shadow-lg"
    >
      <div class="flex items-center gap-2 border-b border-surface-border px-3 py-2">
        <Search :size="14" class="shrink-0 text-ink-400" />
        <input
          ref="searchInputRef"
          v-model="searchTerm"
          type="text"
          :placeholder="searchPlaceholder"
          class="w-full text-sm text-ink-900 outline-none placeholder:text-ink-400"
        />
      </div>

      <ul :id="listboxId" role="listbox" class="max-h-48 overflow-y-auto py-1">
        <li
          v-for="option in filteredOptions"
          :key="option.id"
          role="option"
          class="flex cursor-pointer items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-brand-50"
          :class="option.id === modelValue ? 'bg-brand-50 font-medium text-brand-700' : 'text-ink-900'"
          @click="selectOption(option)"
        >
          {{ option.name }}
          <Check v-if="option.id === modelValue" :size="14" class="text-brand-600" />
        </li>

        <li v-if="!filteredOptions.length" class="px-3 py-4 text-center text-sm text-ink-400">
          {{ emptyText }}
        </li>
      </ul>
    </div>
  </div>
</template>