<script setup>
import { onMounted, ref } from 'vue'
import { Users, Plus, Pencil, Trash2, Car, Wrench, Mail, Phone, IdCard } from '@lucide/vue'
import AppShell from '../components/layout/AppShell.vue'
import EmptyState from '../components/dashboard/EmptyState.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import ConfirmModal from '../components/ui/ConfirmModal.vue'
import PersonFormModal from '../components/people/PersonFormModal.vue'
import VehicleFormModal from '../components/people/VehicleFormModal.vue'
import RevisionsModal from '../components/people/RevisionsModal.vue'
import { usePeople } from '../composables/usePeople'
import { useToast } from '../composables/useToast'

const { people, isLoading, errorMessage, fetchPeople, createPerson, updatePerson, deletePerson } =
  usePeople()

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

onMounted(fetchPeople)

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
    const message = error.response?.data?.message ?? error.response?.data?.error ?? 'Não foi possível salvar a pessoa.'
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
</script>

<template>
  <AppShell title="Pessoas" subtitle="Gerencie as pessoas cadastradas.">
    <template #actions>
      <BaseButton v-if="people.length" class="w-full sm:w-auto" @click="openNewPerson">
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
      v-else-if="!people.length"
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
      <!-- Mobile: stacked cards. Tables force horizontal scroll or unreadably
           tiny text on small screens, so below `sm` we switch to a card list. -->
      <div class="flex flex-col gap-3 sm:hidden">
        <div
          v-for="person in people"
          :key="person.id"
          class="rounded-2xl border border-ink-100 p-4"
        >
          <p class="truncate text-sm font-semibold text-ink-900">{{ person.name }}</p>

          <div class="mt-2 flex flex-col gap-1 text-xs text-ink-500">
            <div class="flex items-center gap-1.5">
              <Mail :size="12" class="shrink-0 text-ink-300" />
              <span class="truncate">{{ person.email || '—' }}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <Phone :size="12" class="shrink-0 text-ink-300" />
              <span class="truncate">{{ person.phone || '—' }}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <IdCard :size="12" class="shrink-0 text-ink-300" />
              <span class="truncate">{{ person.document || '—' }}</span>
            </div>
          </div>

          <div class="mt-3 flex items-center justify-end gap-1 border-t border-ink-100 pt-3">
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
      <div class="hidden overflow-hidden rounded-2xl border border-ink-100 sm:block">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-ink-50 text-ink-500">
              <tr>
                <th class="px-4 py-3 font-medium">Nome</th>
                <th class="px-4 py-3 font-medium">E-mail</th>
                <th class="px-4 py-3 font-medium">Telefone</th>
                <th class="px-4 py-3 font-medium">CPF</th>
                <th class="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-ink-100">
              <tr v-for="person in people" :key="person.id" class="text-ink-700">
                <td class="px-4 py-3">{{ person.name }}</td>
                <td class="px-4 py-3">{{ person.email }}</td>
                <td class="px-4 py-3">{{ person.phone }}</td>
                <td class="px-4 py-3">{{ person.document }}</td>
                <td class="px-4 py-3">
                  <div class="flex justify-end gap-2">
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
    />
  </AppShell>
</template>