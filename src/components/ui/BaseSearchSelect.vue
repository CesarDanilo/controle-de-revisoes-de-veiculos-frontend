<script setup>
import { ref, computed, watch, nextTick, useId } from 'vue'
import { ChevronDown, Search, Check } from '@lucide/vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, required: true },
  placeholder: { type: String, default: 'Selecione' },
  loadingText: { type: String, default: 'Carregando...' },
  searchPlaceholder: { type: String, default: 'Pesquisar...' },
  emptyText: { type: String, default: 'Nenhum resultado encontrado.' },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  searchMaxLength: { type: Number, default: 30 },
})

const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)
const searchTerm = ref('')
const triggerRef = ref(null)
const searchInputRef = ref(null)
const rootRef = ref(null)
const listboxId = useId()

const activeIndex = ref(-1)
const optionRefs = ref([])

const selectedOption = computed(() =>
  props.options.find((option) => option.id === props.modelValue) ?? null
)

const filteredOptions = computed(() => {
  const term = searchTerm.value.trim().toLowerCase()
  if (!term) return props.options
  return props.options.filter((option) => option.name.toLowerCase().includes(term))
})

const isDisabled = computed(() => props.disabled || props.loading)

const remainingChars = computed(() => props.searchMaxLength - searchTerm.value.length)
const isNearLimit = computed(() => remainingChars.value <= 5)
const isAtLimit = computed(() => remainingChars.value <= 0)

const activeOptionId = computed(() => {
  const option = filteredOptions.value[activeIndex.value]
  return option ? `${listboxId}-option-${option.id}` : undefined
})

function setOptionRef(el, index) {
  if (el) optionRefs.value[index] = el
}

function scrollActiveIntoView() {
  const el = optionRefs.value[activeIndex.value]
  if (el) el.scrollIntoView({ block: 'nearest' })
}

function initActiveIndex() {
  const selectedIndex = filteredOptions.value.findIndex((option) => option.id === props.modelValue)
  activeIndex.value = selectedIndex !== -1 ? selectedIndex : (filteredOptions.value.length ? 0 : -1)
}

async function openDropdown() {
  if (isDisabled.value) return
  isOpen.value = true
  searchTerm.value = ''
  await nextTick()
  initActiveIndex()
  searchInputRef.value?.focus()
  await nextTick()
  scrollActiveIntoView()
}

function closeDropdown() {
  isOpen.value = false
  searchTerm.value = ''
  activeIndex.value = -1
  optionRefs.value = []
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

function handleTriggerKeydown(event) {
  if (isDisabled.value) return
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    if (!isOpen.value) {
      openDropdown()
    }
  }
}

async function handleSearchKeydown(event) {
  if (!filteredOptions.value.length) return

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = activeIndex.value < filteredOptions.value.length - 1 ? activeIndex.value + 1 : 0
    await nextTick()
    scrollActiveIntoView()
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = activeIndex.value > 0 ? activeIndex.value - 1 : filteredOptions.value.length - 1
    await nextTick()
    scrollActiveIntoView()
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    const option = filteredOptions.value[activeIndex.value]
    if (option) selectOption(option)
  }
}

watch(filteredOptions, () => {
  if (!isOpen.value) return
  optionRefs.value = []
  if (!filteredOptions.value.length) {
    activeIndex.value = -1
    return
  }
  if (activeIndex.value >= filteredOptions.value.length) {
    activeIndex.value = filteredOptions.value.length - 1
  } else if (activeIndex.value === -1) {
    activeIndex.value = 0
  }
})

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
      @keydown="handleTriggerKeydown"
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
        <div class="relative flex-1">
          <input
            ref="searchInputRef"
            v-model="searchTerm"
            type="text"
            :maxlength="searchMaxLength"
            :placeholder="searchPlaceholder"
            role="combobox"
            :aria-expanded="isOpen"
            aria-autocomplete="list"
            :aria-controls="listboxId"
            :aria-activedescendant="activeOptionId"
            class="w-full text-sm text-ink-900 outline-none placeholder:text-ink-400"
            @keydown="handleSearchKeydown"
          />
          <span
            v-if="searchTerm.length > 0"
            class="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 select-none text-[11px] tabular-nums transition-colors"
            :class="isAtLimit ? 'text-red-500' : isNearLimit ? 'text-amber-500' : 'text-ink-300'"
          >
            {{ searchTerm.length }}/{{ searchMaxLength }}
          </span>
        </div>
      </div>

      <ul :id="listboxId" role="listbox" class="max-h-48 overflow-y-auto py-1">
        <li
          v-for="(option, index) in filteredOptions"
          :id="`${listboxId}-option-${option.id}`"
          :key="option.id"
          :ref="(el) => setOptionRef(el, index)"
          role="option"
          :aria-selected="option.id === modelValue"
          class="flex cursor-pointer items-center justify-between px-3 py-2 text-sm transition-colors"
          :class="[
            index === activeIndex
              ? 'bg-brand-100 text-brand-700'
              : option.id === modelValue
                ? 'bg-brand-50 font-medium text-brand-700'
                : 'text-ink-900 hover:bg-brand-50',
          ]"
          @mouseenter="activeIndex = index"
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