<script setup>
import { onMounted, reactive, ref } from 'vue'
import { Car, Wrench, Plus, X, Loader2, AlertCircle, Pencil, Trash2, Check } from '@lucide/vue'
import BaseModal from '../ui/BaseModal.vue'
import { vehicleService } from '../../services/vehicle.service'
import { revisionService } from '../../services/revision.service'

const props = defineProps({
  person: { type: Object, required: true },
})

const emit = defineEmits(['close'])

const vehicles = ref([])
const revisionsByVehicle = reactive({})
const isLoading = ref(true)

// --- Revision form state (shared between create and edit) ---
const openFormVehicleId = ref(null)
const formMode = ref('create') // 'create' | 'edit'
const editingRevisionId = ref(null)
const isSubmitting = ref(false)
const formError = ref('')
const emptyForm = () => ({
  description: '',
  revision_date: new Date().toISOString().slice(0, 10),
  km: null,
  cost: null,
  next_revision_date: '',
  next_revision_km: null,
})
const formData = reactive(emptyForm())

// --- Delete state ---
const confirmingDeleteId = ref(null)
const deletingRevisionId = ref(null)
const deleteErrorByVehicle = reactive({})

const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === '') return '—'
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const isOverdue = (dateStr) => {
  if (!dateStr) return false
  const date = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date < today
}

const sortRevisions = (list) =>
  [...list].sort((a, b) => new Date(b.revision_date) - new Date(a.revision_date))

const loadAll = async () => {
  isLoading.value = true
  try {
    const allVehicles = await vehicleService.list()
    vehicles.value = allVehicles.filter((v) => v.people_id === props.person.id)

    const results = await Promise.all(
      vehicles.value.map((vehicle) => revisionService.listByVehicle(vehicle.id))
    )

    vehicles.value.forEach((vehicle, index) => {
      const raw = results[index]
      const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : []
      revisionsByVehicle[vehicle.id] = sortRevisions(list)
    })
  } finally {
    isLoading.value = false
  }
}

// Open the form fresh, for creating a new revision on this vehicle.
const toggleForm = (vehicleId) => {
  if (openFormVehicleId.value === vehicleId && formMode.value === 'create') {
    closeForm()
    return
  }
  openFormVehicleId.value = vehicleId
  formMode.value = 'create'
  editingRevisionId.value = null
  formError.value = ''
  Object.assign(formData, emptyForm())
}

// Open the same form pre-filled, for editing an existing revision.
const startEdit = (vehicleId, revision) => {
  confirmingDeleteId.value = null
  openFormVehicleId.value = vehicleId
  formMode.value = 'edit'
  editingRevisionId.value = revision.id
  formError.value = ''
  Object.assign(formData, {
    description: revision.description || '',
    revision_date: revision.revision_date ? revision.revision_date.slice(0, 10) : '',
    km: revision.km !== null && revision.km !== undefined && revision.km !== '' ? Number(revision.km) : null,
    cost:
      revision.cost !== null && revision.cost !== undefined && revision.cost !== ''
        ? Number(revision.cost)
        : null,
    next_revision_date: revision.next_revision_date ? revision.next_revision_date.slice(0, 10) : '',
    next_revision_km:
      revision.next_revision_km !== null &&
      revision.next_revision_km !== undefined &&
      revision.next_revision_km !== ''
        ? Number(revision.next_revision_km)
        : null,
  })
}

const closeForm = () => {
  openFormVehicleId.value = null
  formMode.value = 'create'
  editingRevisionId.value = null
  formError.value = ''
}

const submitRevision = async (vehicle) => {
  formError.value = ''

  if (!vehicle?.id) {
    formError.value = 'Veículo inválido (ID não encontrado).'
    return
  }
  if (!formData.description.trim()) {
    formError.value = 'Informe uma descrição para a revisão.'
    return
  }
  if (!formData.revision_date) {
    formError.value = 'Informe a data da revisão.'
    return
  }
  if (
    formData.next_revision_date &&
    new Date(formData.next_revision_date) < new Date(formData.revision_date)
  ) {
    formError.value = 'A próxima revisão não pode ser antes da data da revisão atual.'
    return
  }

  isSubmitting.value = true
  try {
    const payload = {
      vehicle_id: vehicle.id,
      description: formData.description.trim(),
      revision_date: formData.revision_date,
      km: formData.km || null,
      cost: formData.cost || null,
      next_revision_date: formData.next_revision_date || null,
      next_revision_km: formData.next_revision_km || null,
    }

    if (formMode.value === 'edit' && editingRevisionId.value) {
      const rawUpdated = await revisionService.update(editingRevisionId.value, payload)
      const updated = rawUpdated?.data ?? rawUpdated
      const currentList = revisionsByVehicle[vehicle.id] || []
      const idx = currentList.findIndex((r) => r.id === editingRevisionId.value)
      if (idx !== -1) {
        currentList.splice(idx, 1, { ...currentList[idx], ...updated })
      }
      revisionsByVehicle[vehicle.id] = sortRevisions(currentList)
    } else {
      const rawCreated = await revisionService.create(payload)
      const created = rawCreated?.data ?? rawCreated
      const currentList = revisionsByVehicle[vehicle.id] || []
      revisionsByVehicle[vehicle.id] = sortRevisions([created, ...currentList])
    }

    closeForm()
  } catch (err) {
    // Surface the real reason instead of hiding it — Laravel returns 422
    // with field-level messages when validation fails.
    console.error('Erro ao salvar revisão:', err.response?.data ?? err)

    const validationErrors = err.response?.data?.errors
    if (validationErrors) {
      formError.value = Object.values(validationErrors).flat().join(' ')
    } else {
      formError.value =
        err.response?.data?.message ||
        err.message ||
        'Não foi possível salvar a revisão. Tente novamente.'
    }
  } finally {
    isSubmitting.value = false
  }
}

// --- Delete flow: click once to arm confirmation, click again to confirm ---
const askDelete = (revisionId) => {
  confirmingDeleteId.value = revisionId
}

const cancelDelete = () => {
  confirmingDeleteId.value = null
}

const confirmDelete = async (vehicleId, revisionId) => {
  deletingRevisionId.value = revisionId
  deleteErrorByVehicle[vehicleId] = ''
  try {
    await revisionService.delete(revisionId)
    revisionsByVehicle[vehicleId] = (revisionsByVehicle[vehicleId] || []).filter(
      (r) => r.id !== revisionId
    )
    if (editingRevisionId.value === revisionId) {
      closeForm()
    }
  } catch (err) {
    console.error('Erro ao excluir revisão:', err.response?.data ?? err)
    deleteErrorByVehicle[vehicleId] =
      err.response?.data?.message || 'Não foi possível excluir a revisão. Tente novamente.'
  } finally {
    deletingRevisionId.value = null
    confirmingDeleteId.value = null
  }
}

onMounted(loadAll)
</script>

<template>
  <BaseModal :title="`Revisões de ${person.name}`" size="xl" @close="emit('close')">
    <div v-if="isLoading" class="py-12 text-center text-sm text-ink-500">
      Carregando revisões...
    </div>

    <div
      v-else-if="!vehicles.length"
      class="flex flex-col items-center gap-2 rounded-xl border border-dashed border-surface-border py-12 text-center"
    >
      <Car :size="24" class="text-ink-300" />
      <p class="text-sm text-ink-500">Essa pessoa ainda não tem veículos cadastrados.</p>
    </div>

    <div v-else class="flex max-h-[70vh] flex-col gap-6 overflow-y-auto pr-1">
      <div v-for="vehicle in vehicles" :key="vehicle.id">
        <div class="mb-2 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Car :size="16" class="text-ink-500" />
            <h3 class="text-sm font-semibold text-ink-900">
              {{ vehicle.model }} · {{ vehicle.license_plate }}
            </h3>
          </div>
          <button
            type="button"
            class="flex items-center gap-1 text-xs font-medium text-brand-600 transition-colors hover:text-brand-700"
            @click="toggleForm(vehicle.id)"
          >
            <component
              :is="openFormVehicleId === vehicle.id && formMode === 'create' ? X : Plus"
              :size="14"
            />
            {{ openFormVehicleId === vehicle.id && formMode === 'create' ? 'Cancelar' : 'Nova revisão' }}
          </button>
        </div>

        <p v-if="deleteErrorByVehicle[vehicle.id]" class="mb-2 flex items-center gap-1 text-xs text-red-600">
          <AlertCircle :size="13" />
          {{ deleteErrorByVehicle[vehicle.id] }}
        </p>

        <!-- Revision form: create or edit -->
        <Transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 -translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <form
            v-if="openFormVehicleId === vehicle.id"
            class="mb-3 rounded-xl border p-4"
            :class="formMode === 'edit' ? 'border-amber-200 bg-amber-50/60' : 'border-brand-200 bg-brand-50/60'"
            @submit.prevent="submitRevision(vehicle)"
          >
            <p class="mb-3 text-xs font-semibold" :class="formMode === 'edit' ? 'text-amber-700' : 'text-brand-700'">
              {{ formMode === 'edit' ? 'Editando revisão' : 'Nova revisão' }}
            </p>

            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div class="col-span-2 sm:col-span-4">
                <label class="mb-1 block text-xs font-medium text-ink-600">
                  Descrição <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="formData.description"
                  type="text"
                  placeholder="Ex: Troca de óleo e filtros"
                  class="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  autofocus
                />
              </div>

              <div>
                <label class="mb-1 block text-xs font-medium text-ink-600">
                  Data <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="formData.revision_date"
                  type="date"
                  class="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label class="mb-1 block text-xs font-medium text-ink-600">KM</label>
                <input
                  v-model.number="formData.km"
                  type="number"
                  min="0"
                  placeholder="0"
                  class="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label class="mb-1 block text-xs font-medium text-ink-600">Custo (R$)</label>
                <input
                  v-model.number="formData.cost"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  class="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label class="mb-1 block text-xs font-medium text-ink-600">Próxima revisão (data)</label>
                <input
                  v-model="formData.next_revision_date"
                  type="date"
                  class="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label class="mb-1 block text-xs font-medium text-ink-600">Próxima revisão (KM)</label>
                <input
                  v-model.number="formData.next_revision_km"
                  type="number"
                  min="0"
                  placeholder="0"
                  class="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            <div class="mt-3 flex items-center justify-end gap-3 border-t pt-3" :class="formMode === 'edit' ? 'border-amber-100' : 'border-brand-100'">
              <p v-if="formError" class="mr-auto flex items-center gap-1 text-xs text-red-600">
                <AlertCircle :size="13" />
                {{ formError }}
              </p>
              <button
                type="button"
                class="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-500 transition-colors hover:bg-ink-100"
                @click="closeForm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                :disabled="isSubmitting"
                class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                :class="formMode === 'edit' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-brand-600 hover:bg-brand-700'"
              >
                <Loader2 v-if="isSubmitting" :size="13" class="animate-spin" />
                {{ isSubmitting ? 'Salvando...' : formMode === 'edit' ? 'Salvar alterações' : 'Salvar revisão' }}
              </button>
            </div>
          </form>
        </Transition>

        <div class="overflow-hidden rounded-xl border border-ink-100">
          <table class="w-full text-left text-xs">
            <thead class="bg-ink-50 text-ink-500">
              <tr>
                <th class="px-3 py-2 font-medium">Descrição</th>
                <th class="px-3 py-2 font-medium">Data</th>
                <th class="px-3 py-2 font-medium">KM</th>
                <th class="px-3 py-2 font-medium">Custo</th>
                <th class="px-3 py-2 font-medium">Próxima revisão</th>
                <th class="px-3 py-2 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-ink-100">
              <tr v-if="!revisionsByVehicle[vehicle.id]?.length">
                <td colspan="6" class="px-3 py-4 text-center text-ink-400">
                  Nenhuma revisão registrada.
                </td>
              </tr>
              <tr
                v-for="revision in revisionsByVehicle[vehicle.id]"
                :key="revision.id"
                class="text-ink-700"
                :class="editingRevisionId === revision.id ? 'bg-amber-50/50' : ''"
              >
                <td class="px-3 py-2">
                  <div class="flex items-center gap-1.5">
                    <Wrench :size="12" class="text-ink-400" />
                    {{ revision.description || '—' }}
                  </div>
                </td>
                <td class="px-3 py-2">{{ formatDate(revision.revision_date) }}</td>
                <td class="px-3 py-2">{{ revision.km ?? '—' }}</td>
                <td class="px-3 py-2">{{ formatCurrency(revision.cost) }}</td>
                <td
                  class="px-3 py-2"
                  :class="isOverdue(revision.next_revision_date) ? 'font-medium text-red-600' : ''"
                >
                  <div>{{ formatDate(revision.next_revision_date) }}</div>
                  <div v-if="revision.next_revision_km" class="text-[11px] text-ink-400">
                    {{ Number(revision.next_revision_km).toLocaleString('pt-BR') }} km
                  </div>
                </td>
                <td class="px-3 py-2">
                  <div class="flex items-center justify-end gap-1">
                    <!-- Two-step delete confirmation, no native confirm() -->
                    <template v-if="confirmingDeleteId === revision.id">
                      <span class="mr-1 text-[11px] text-ink-500">Excluir?</span>
                      <button
                        type="button"
                        title="Confirmar exclusão"
                        :disabled="deletingRevisionId === revision.id"
                        class="rounded-md p-1 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                        @click="confirmDelete(vehicle.id, revision.id)"
                      >
                        <Loader2 v-if="deletingRevisionId === revision.id" :size="14" class="animate-spin" />
                        <Check v-else :size="14" />
                      </button>
                      <button
                        type="button"
                        title="Cancelar"
                        :disabled="deletingRevisionId === revision.id"
                        class="rounded-md p-1 text-ink-400 transition-colors hover:bg-ink-100 disabled:opacity-50"
                        @click="cancelDelete"
                      >
                        <X :size="14" />
                      </button>
                    </template>
                    <template v-else>
                      <button
                        type="button"
                        title="Editar revisão"
                        class="rounded-md p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
                        @click="startEdit(vehicle.id, revision)"
                      >
                        <Pencil :size="14" />
                      </button>
                      <button
                        type="button"
                        title="Excluir revisão"
                        class="rounded-md p-1 text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        @click="askDelete(revision.id)"
                      >
                        <Trash2 :size="14" />
                      </button>
                    </template>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </BaseModal>
</template>