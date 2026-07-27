<script setup>
import { computed, onMounted, ref } from 'vue'
import { Users, Plus, Pencil, Trash2, Car, Wrench, Mail, Phone, IdCard, Search, X, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown } from '@lucide/vue'
import AppShell from '../components/layout/AppShell.vue'
import EmptyState from '../components/dashboard/EmptyState.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import ConfirmModal from '../components/ui/ConfirmModal.vue'
import PersonFormModal from '../components/people/PersonFormModal.vue'
import VehicleFormModal from '../components/people/VehicleFormModal.vue'
import RevisionsModal from '../components/people/RevisionsModal.vue'
import { usePeople } from '../composables/usePeople'
import { useToast } from '../composables/useToast'
import { maskPhone, maskDocument, blockNonNumericKey } from '../utils/masks'
import { translateApiError } from '../utils/apiErrors'

const {
  people,
  isLoading,
  errorMessage,
  currentPage,
  lastPage,
  total,
  perPage,
  fetchPeople,
  applyFilters,
  clearFilters: clearFiltersRequest,
  createPerson,
  updatePerson,
  deletePerson,
} = usePeople()

const toast = useToast()

const isModalOpen = ref(false)
const editingPerson = ref(null)

const isConfirmOpen = ref(false)
const personToDelete = ref(null)
const isDeleting = ref(false)
const isSubmitting = ref(false)

const isVehicleModalOpen = ref(false)
const personForVehicle = ref(null)

const isRevisionsModalOpen = ref(false)
const personForRevisions = ref(null)

// --- Filtros (agora buscam no backend, em todas as pessoas) ---
// Ref local só pra ligação com os inputs (atualiza a UI na hora).
// O envio real pro backend é debounced, pra não disparar uma request a cada tecla.
const filterInputs = ref({
  name: '',
  email: '',
  phone: '',
  document: '',
})

let debounceTimer = null
const DEBOUNCE_MS = 400

const scheduleFilterUpdate = () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    applyFilters({ ...filterInputs.value })
  }, DEBOUNCE_MS)
}

const hasActiveFilters = computed(() =>
  Object.values(filterInputs.value).some((value) => value.trim() !== '')
)

const clearFilters = async () => {
  clearTimeout(debounceTimer)
  filterInputs.value = { name: '', email: '', phone: '', document: '' }
  await clearFiltersRequest()
}
// --- fim filtros ---

// --- Ordenação (client-side, sobre a página atual) ---
const sortField = ref(null) // 'name' | 'email' | 'phone' | 'document' | null
const sortDirection = ref('asc') // 'asc' | 'desc'

const toggleSort = (field) => {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortDirection.value = 'asc'
  }
}

const sortIconFor = (field) => {
  if (sortField.value !== field) return ArrowUpDown
  return sortDirection.value === 'asc' ? ArrowUp : ArrowDown
}

const sortedPeople = computed(() => {
  if (!sortField.value) return people.value
  const field = sortField.value
  const dir = sortDirection.value === 'asc' ? 1 : -1
  return [...people.value].sort((a, b) => {
    const valA = (a[field] ?? '').toString().toLowerCase()
    const valB = (b[field] ?? '').toString().toLowerCase()
    if (valA < valB) return -1 * dir
    if (valA > valB) return 1 * dir
    return 0
  })
})
// --- fim ordenação ---

// --- Avatar ---
const getInitials = (name) => {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}
// --- fim avatar ---

onMounted(() => fetchPeople(1))

// --- Paginação (mesmo estilo/lógica do DataTable.vue) ---
const goToPage = (page) => {
  if (
    typeof page !== 'number' ||
    page < 1 ||
    page > lastPage.value ||
    page === currentPage.value ||
    isLoading.value
  ) {
    return
  }
  fetchPeople(page)
}

const rangeLabel = computed(() => {
  if (!total.value) return ''
  const from = (currentPage.value - 1) * perPage.value + 1
  const to = Math.min(currentPage.value * perPage.value, total.value)
  return `Mostrando ${from}–${to} de ${total.value}`
})

// Janela de páginas visíveis (máx. 5 números, com "…" nas pontas quando necessário)
const visiblePages = computed(() => {
  const delta = 1
  const range = []
  const withDots = []
  let last = null

  for (let i = 1; i <= lastPage.value; i++) {
    if (i === 1 || i === lastPage.value || (i >= currentPage.value - delta && i <= currentPage.value + delta)) {
      range.push(i)
    }
  }

  for (const i of range) {
    if (last !== null) {
      if (i - last === 2) withDots.push(last + 1)
      else if (i - last > 2) withDots.push('...')
    }
    withDots.push(i)
    last = i
  }

  return withDots
})
// --- fim paginação ---

const openNewPerson = () => {
  editingPerson.value = null
  isModalOpen.value = true
}

const openEdit = (person) => {
  editingPerson.value = person
  isModalOpen.value = true
}

const closeModal = () => {
  isModalOpen.value = false
  editingPerson.value = null
}

const handleSubmit = async (payload) => {
  isSubmitting.value = true
  try {
    if (editingPerson.value) {
      await updatePerson(editingPerson.value.id, payload)
      toast.success('Pessoa atualizada com sucesso!')
    } else {
      await createPerson(payload)
      toast.success('Pessoa cadastrada com sucesso!')
    }
    closeModal()
  } catch (error) {
    const rawMessage = error.response?.data?.message ?? error.response?.data?.error
    const message = translateApiError(rawMessage, 'Não foi possível salvar a pessoa.')
    toast.error(message)
  } finally {
    isSubmitting.value = false
  }
}

const askDelete = (person) => {
  personToDelete.value = person
  isConfirmOpen.value = true
}

const closeConfirm = () => {
  isConfirmOpen.value = false
  personToDelete.value = null
}

const confirmDelete = async () => {
  if (!personToDelete.value) return
  isDeleting.value = true
  try {
    await deletePerson(personToDelete.value.id)
    toast.success('Pessoa removida com sucesso!')
    closeConfirm()
  } catch (error) {
    const message = error.response?.data?.message ?? error.response?.data?.error ?? 'Não foi possível remover a pessoa.'
    toast.error(message)
  } finally {
    isDeleting.value = false
  }
}

const openVehicleModal = (person) => {
  personForVehicle.value = person
  isVehicleModalOpen.value = true
}

const closeVehicleModal = () => {
  isVehicleModalOpen.value = false
  personForVehicle.value = null
}

const openRevisionsModal = (person) => {
  personForRevisions.value = person
  isRevisionsModalOpen.value = true
}

const closeRevisionsModal = () => {
  isRevisionsModalOpen.value = false
  personForRevisions.value = null
}

const goToVehicleRegistrationFromRevisions = () => {
  const person = personForRevisions.value
  closeRevisionsModal()
  openVehicleModal(person)
}

const sanitizeNumericFilter = (field) => {
  filterInputs.value[field] = filterInputs.value[field].replace(/\D/g, '').slice(0, 11)
  scheduleFilterUpdate()
}
</script>

<template>
  <AppShell title="Proprietários" subtitle="Gerencie as pessoas cadastradas.">
    <template #actions>
      <BaseButton v-if="people.length || hasActiveFilters" class="w-full sm:w-auto" @click="openNewPerson">
        <Plus :size="16" />
        Nova pessoa
      </BaseButton>
    </template>

    <div v-if="isLoading" class="py-12 text-center text-sm text-ink-500">
      Carregando pessoas...
    </div>

    <div v-else-if="errorMessage" class="py-12 text-center text-sm text-red-600">
      {{ errorMessage }}
    </div>

    <EmptyState
      v-else-if="!people.length && !hasActiveFilters"
      :icon="Users"
      title="Nenhuma pessoa cadastrada"
      description="Cadastre uma pessoa para começar a vincular veículos e revisões."
    >
      <BaseButton @click="openNewPerson">
        <Plus :size="16" />
        Cadastrar pessoa
      </BaseButton>
    </EmptyState>

    <template v-else>
      <div class="mb-4 rounded-2xl border border-ink-100/70 bg-white p-4 shadow-sm shadow-ink-900/[0.03]">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div class="relative">
            <Search :size="14" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
            <input
              v-model="filterInputs.name"
              type="text"
              placeholder="Filtrar por nome"
              class="w-full rounded-xl border border-ink-100 py-2 pl-9 pr-3 text-sm text-ink-700 placeholder:text-ink-300 focus:border-brand-400 focus:outline-none"
              @input="scheduleFilterUpdate"
            />
          </div>
          <div class="relative">
            <Mail :size="14" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
            <input
              v-model="filterInputs.email"
              type="text"
              placeholder="Filtrar por e-mail"
              class="w-full rounded-xl border border-ink-100 py-2 pl-9 pr-3 text-sm text-ink-700 placeholder:text-ink-300 focus:border-brand-400 focus:outline-none"
              @input="scheduleFilterUpdate"
            />
          </div>
          <div class="relative">
            <Phone :size="14" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
            <input
              v-model="filterInputs.phone"
              type="text"
              placeholder="Filtrar por telefone"
              class="w-full rounded-xl border border-ink-100 py-2 pl-9 pr-3 text-sm text-ink-700 placeholder:text-ink-300 focus:border-brand-400 focus:outline-none"
              @keydown="blockNonNumericKey"
              @input="sanitizeNumericFilter('phone')"
            />
          </div>
          <div class="relative">
            <IdCard :size="14" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
            <input
              v-model="filterInputs.document"
              type="text"
              placeholder="Filtrar por CPF"
              class="w-full rounded-xl border border-ink-100 py-2 pl-9 pr-3 text-sm text-ink-700 placeholder:text-ink-300 focus:border-brand-400 focus:outline-none"
              @keydown="blockNonNumericKey"
              @input="sanitizeNumericFilter('document')"
            />
          </div>
        </div>

        <div v-if="hasActiveFilters" class="mt-3 flex items-center justify-between">
          <span class="text-xs text-ink-500">
            {{ total }} pessoa(s) encontrada(s)
          </span>
          <button
            type="button"
            class="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-600"
            @click="clearFilters"
          >
            <X :size="14" />
            Limpar filtros
          </button>
        </div>
      </div>

      <EmptyState
        v-if="!people.length"
        :icon="Search"
        title="Nenhuma pessoa encontrada"
        description="Ajuste os filtros para encontrar a pessoa desejada."
      >
        <BaseButton variant="secondary" @click="clearFilters">
          <X :size="16" />
          Limpar filtros
        </BaseButton>
      </EmptyState>

      <template v-else>
        <!-- mobile: cards -->
        <div class="flex flex-col gap-3 sm:hidden">
          <div
            v-for="person in sortedPeople"
            :key="person.id"
            class="rounded-2xl border border-ink-100/70 bg-white p-4 shadow-sm shadow-ink-900/[0.03] transition-shadow active:shadow-none"
          >
            <div class="flex items-center gap-3">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-600">
                {{ getInitials(person.name) }}
              </div>
              <p class="truncate text-sm font-semibold text-ink-900">{{ person.name }}</p>
            </div>

            <div class="mt-3 flex flex-col gap-1.5 text-xs text-ink-500">
              <div class="flex items-center gap-1.5">
                <Mail :size="12" class="shrink-0 text-ink-300" />
                <span class="truncate">{{ person.email || '—' }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <Phone :size="12" class="shrink-0 text-ink-300" />
                <span class="truncate">{{ maskPhone(person.phone) || '—' }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <IdCard :size="12" class="shrink-0 text-ink-300" />
                <span class="truncate">{{ maskDocument(person.document) || '—' }}</span>
              </div>
            </div>

            <div class="mt-3 flex items-center justify-end gap-1 border-t border-ink-100/70 pt-3">
              <button
                type="button"
                class="rounded-lg p-2.5 text-ink-400 transition-colors active:bg-brand-50 active:text-brand-600"
                aria-label="Adicionar veículo"
                @click="openVehicleModal(person)"
              >
                <Car :size="18" />
              </button>
              <button
                type="button"
                class="rounded-lg p-2.5 text-ink-400 transition-colors active:bg-brand-50 active:text-brand-600"
                aria-label="Ver revisões"
                @click="openRevisionsModal(person)"
              >
                <Wrench :size="18" />
              </button>
              <button
                type="button"
                class="rounded-lg p-2.5 text-ink-400 transition-colors active:bg-ink-50 active:text-brand-600"
                aria-label="Editar"
                @click="openEdit(person)"
              >
                <Pencil :size="18" />
              </button>
              <button
                type="button"
                class="rounded-lg p-2.5 text-ink-400 transition-colors active:bg-red-50 active:text-red-600"
                aria-label="Remover"
                @click="askDelete(person)"
              >
                <Trash2 :size="18" />
              </button>
            </div>
          </div>
        </div>

        <!-- sm and up: full table -->
        <div class="hidden overflow-hidden rounded-2xl border border-ink-100/70 bg-white shadow-sm shadow-ink-900/[0.03] sm:block">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="bg-ink-50/60">
                <tr>
                  <th class="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                    <button type="button" class="inline-flex items-center gap-1 hover:text-ink-600" @click="toggleSort('name')">
                      Nome
                      <component :is="sortIconFor('name')" :size="12" :class="sortField === 'name' ? 'text-brand-600' : 'text-ink-300'" />
                    </button>
                  </th>
                  <th class="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                    <button type="button" class="inline-flex items-center gap-1 hover:text-ink-600" @click="toggleSort('email')">
                      E-mail
                      <component :is="sortIconFor('email')" :size="12" :class="sortField === 'email' ? 'text-brand-600' : 'text-ink-300'" />
                    </button>
                  </th>
                  <th class="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                    <button type="button" class="inline-flex items-center gap-1 hover:text-ink-600" @click="toggleSort('phone')">
                      Telefone
                      <component :is="sortIconFor('phone')" :size="12" :class="sortField === 'phone' ? 'text-brand-600' : 'text-ink-300'" />
                    </button>
                  </th>
                  <th class="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                    <button type="button" class="inline-flex items-center gap-1 hover:text-ink-600" @click="toggleSort('document')">
                      CPF/CNPJ
                      <component :is="sortIconFor('document')" :size="12" :class="sortField === 'document' ? 'text-brand-600' : 'text-ink-300'" />
                    </button>
                  </th>
                  <th class="px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider text-ink-400">Ações</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-ink-100/60">
                <tr
                  v-for="person in sortedPeople"
                  :key="person.id"
                  class="group text-ink-700 transition-colors hover:bg-ink-50/50"
                >
                  <td class="px-5 py-3.5">
                    <div class="flex items-center gap-3">
                      <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-600">
                        {{ getInitials(person.name) }}
                      </div>
                      <span class="font-medium text-ink-900">{{ person.name }}</span>
                    </div>
                  </td>
                  <td class="px-5 py-3.5 text-ink-500">{{ person.email || '—' }}</td>
                  <td class="px-5 py-3.5 text-ink-500">{{ maskPhone(person.phone) || '—' }}</td>
                  <td class="px-5 py-3.5 text-ink-500">{{ maskDocument(person.document) || '—' }}</td>
                  <td class="px-5 py-3.5">
                    <div class="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <button
                        type="button"
                        class="rounded-lg p-2 text-ink-400 transition-colors hover:bg-brand-50 hover:text-brand-600"
                        aria-label="Adicionar veículo"
                        @click="openVehicleModal(person)"
                      >
                        <Car :size="16" />
                      </button>
                      <button
                        type="button"
                        class="rounded-lg p-2 text-ink-400 transition-colors hover:bg-brand-50 hover:text-brand-600"
                        aria-label="Ver revisões"
                        @click="openRevisionsModal(person)"
                      >
                        <Wrench :size="16" />
                      </button>
                      <button
                        type="button"
                        class="rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-50 hover:text-brand-600"
                        aria-label="Editar"
                        @click="openEdit(person)"
                      >
                        <Pencil :size="16" />
                      </button>
                      <button
                        type="button"
                        class="rounded-lg p-2 text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        aria-label="Remover"
                        @click="askDelete(person)"
                      >
                        <Trash2 :size="16" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Paginação (mesmo estilo do DataTable.vue) -->
        <div
          v-if="lastPage > 1"
          class="mt-4 flex flex-col items-center justify-between gap-3 border-t border-ink-100 pt-3 sm:flex-row"
        >
          <p class="text-xs text-ink-400">{{ rangeLabel }}</p>

          <div class="flex items-center gap-1">
            <button
              type="button"
              class="flex h-7 w-7 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              :disabled="currentPage <= 1 || isLoading"
              aria-label="Página anterior"
              @click="goToPage(currentPage - 1)"
            >
              <ChevronLeft :size="15" />
            </button>

            <template v-for="(page, idx) in visiblePages" :key="`${page}-${idx}`">
              <span v-if="page === '...'" class="px-1.5 text-xs text-ink-300">…</span>
              <button
                v-else
                type="button"
                class="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                :class="page === currentPage ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-ink-50'"
                :disabled="isLoading"
                :aria-current="page === currentPage ? 'page' : undefined"
                @click="goToPage(page)"
              >
                {{ page }}
              </button>
            </template>

            <button
              type="button"
              class="flex h-7 w-7 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              :disabled="currentPage >= lastPage || isLoading"
              aria-label="Próxima página"
              @click="goToPage(currentPage + 1)"
            >
              <ChevronRight :size="15" />
            </button>
          </div>
        </div>
      </template>
    </template>

    <PersonFormModal
      v-if="isModalOpen"
      :person="editingPerson"
      :is-submitting="isSubmitting"
      @close="closeModal"
      @submit="handleSubmit"
    />

    <ConfirmModal
      v-if="isConfirmOpen"
      title="Remover pessoa"
      :message="`Tem certeza que deseja remover ${personToDelete?.name}? Essa ação não pode ser desfeita.`"
      confirm-label="Remover"
      :is-loading="isDeleting"
      @close="closeConfirm"
      @confirm="confirmDelete"
    />

    <VehicleFormModal
      v-if="isVehicleModalOpen"
      :person="personForVehicle"
      @close="closeVehicleModal"
    />

    <RevisionsModal
      v-if="isRevisionsModalOpen"
      :person="personForRevisions"
      @close="closeRevisionsModal"
      @register-vehicle="goToVehicleRegistrationFromRevisions"
    />
  </AppShell>
</template>