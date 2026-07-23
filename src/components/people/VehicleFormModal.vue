<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { Car, Palette, Calendar, Hash, Plus, X, Pencil, Trash2, Tag } from '@lucide/vue'
import BaseModal from '../ui/BaseModal.vue'
import BaseInput from '../ui/BaseInput.vue'
import BaseButton from '../ui/BaseButton.vue'
import ConfirmModal from '../ui/ConfirmModal.vue'
import { vehicleSchema, carColors } from '../../schemas/vehicle.schema'
import { brandService } from '../../services/brand.service'
import { vehicleService } from '../../services/vehicle.service'
import { useToast } from '../../composables/useToast'

const props = defineProps({
  person: { type: Object, required: true },
})

const emit = defineEmits(['close'])

const toast = useToast()

const emptyForm = () => ({
  model: '',
  year: '',
  color: '',
  brand_id: '',
  license_plate: '',
  people_id: props.person.id,
})

const form = reactive(emptyForm())
const editingVehicleId = ref(null)

// snapshot normalizado do veículo original (usado pra detectar o que mudou)
const originalSnapshot = ref(null)

const vehicles = ref([])
const isLoadingVehicles = ref(true)

const brands = ref([])
const isLoadingBrands = ref(true)

const fieldErrors = ref({})
const isSubmitting = ref(false)

const isCreatingBrand = ref(false)
const newBrandName = ref('')
const isSavingBrand = ref(false)
const newBrandInputRef = ref(null)

const isConfirmOpen = ref(false)
const vehicleToDelete = ref(null)
const isDeleting = ref(false)

const isEditing = computed(() => editingVehicleId.value !== null)

const brandName = (brandId) => brands.value.find((b) => b.id === brandId)?.name ?? '—'

// getter/setter com bloqueio real de caracteres (não só maxlength visual)
const modelValue = computed({
  get: () => form.model,
  set: (value) => {
    form.model = value.slice(0, 40)
  },
})

onMounted(async () => {
  isLoadingBrands.value = true
  isLoadingVehicles.value = true
  try {
    const [brandsList, vehiclesList] = await Promise.all([
      brandService.list(),
      vehicleService.list(),
    ])
    brands.value = brandsList
    vehicles.value = vehiclesList.filter((v) => v.people_id === props.person.id)
  } finally {
    isLoadingBrands.value = false
    isLoadingVehicles.value = false
  }
})

const resetForm = () => {
  Object.assign(form, emptyForm())
  editingVehicleId.value = null
  originalSnapshot.value = null
  fieldErrors.value = {}
}

const selectForEdit = (vehicle) => {
  form.model = vehicle.model
  form.year = String(vehicle.year)
  form.color = vehicle.color
  form.brand_id = vehicle.brand_id
  form.license_plate = vehicle.license_plate
  form.people_id = props.person.id
  editingVehicleId.value = vehicle.id
  fieldErrors.value = {}

  // normaliza o estado original pelo mesmo schema, pra comparar "de igual pra igual" depois
  const parsed = vehicleSchema.safeParse(form)
  originalSnapshot.value = parsed.success ? parsed.data : null
}

// retorna só as chaves que mudaram entre o snapshot original e os dados validados atuais
const getChangedFields = (validatedData) => {
  if (!originalSnapshot.value) return validatedData // fallback: sem snapshot, envia tudo

  const changed = {}
  for (const key of Object.keys(validatedData)) {
    if (key === 'people_id') continue // nunca muda durante a edição, ignora na comparação
    if (validatedData[key] !== originalSnapshot.value[key]) {
      changed[key] = validatedData[key]
    }
  }
  return changed
}

const openBrandCreation = async () => {
  isCreatingBrand.value = true
  newBrandName.value = ''
  await nextTick()
  newBrandInputRef.value?.focus()
}

const cancelBrandCreation = () => {
  isCreatingBrand.value = false
  newBrandName.value = ''
}

const saveNewBrand = async () => {
  const name = newBrandName.value.toUpperCase().trim()
  if (!name) return

  isSavingBrand.value = true
  try {
    const brand = await brandService.create({ name })
    brands.value.push(brand)
    form.brand_id = brand.id
    toast.success('Marca cadastrada com sucesso!')
    cancelBrandCreation()
  } catch (error) {
    const message = error.response?.data?.message ?? error.response?.data?.error ?? 'Não foi possível cadastrar a marca.'
    toast.error(message)
  } finally {
    isSavingBrand.value = false
  }
}

const handleSubmit = async () => {
  const result = vehicleSchema.safeParse(form)

  if (!result.success) {
    fieldErrors.value = result.error.flatten().fieldErrors
    return
  }

  fieldErrors.value = {}

  // --- modo edição: verifica se algo realmente mudou antes de chamar a API ---
  if (isEditing.value) {
    const changedFields = getChangedFields(result.data)

    if (Object.keys(changedFields).length === 0) {
      toast.info('Nenhuma alteração foi feita.')
      return
    }

    isSubmitting.value = true
    // se "year" estiver entre os campos alterados, converte pra number antes de enviar
    const payload = 'year' in changedFields
      ? { ...changedFields, year: Number(changedFields.year) }
      : changedFields

    try {
      const updated = await vehicleService.update(editingVehicleId.value, payload)
      const index = vehicles.value.findIndex((v) => v.id === editingVehicleId.value)
      if (index !== -1) vehicles.value[index] = updated
      toast.success('Veículo atualizado com sucesso!')
      resetForm()
    } catch (error) {
      const message = error.response?.data?.message ?? error.response?.data?.error ?? 'Não foi possível salvar o veículo.'
      toast.error(message)
    } finally {
      isSubmitting.value = false
    }
    return
  }

  // --- modo criação: comportamento original, envia tudo ---
  isSubmitting.value = true
  const payload = { ...result.data, year: Number(result.data.year) }

  try {
    const created = await vehicleService.create(payload)
    vehicles.value.unshift(created)
    toast.success('Veículo cadastrado com sucesso!')
    resetForm()
  } catch (error) {
    const message = error.response?.data?.message ?? error.response?.data?.error ?? 'Não foi possível salvar o veículo.'
    if(message == "The license plate has already been taken.") {
      toast.error("Já existe um veículo com essa placa!")
    }else{
      toast.error(message)
    }
  } finally {
    isSubmitting.value = false
  }
}

const askDeleteVehicle = (vehicle) => {
  vehicleToDelete.value = vehicle
  isConfirmOpen.value = true
}

const closeConfirm = () => {
  isConfirmOpen.value = false
  vehicleToDelete.value = null
}

const confirmDeleteVehicle = async () => {
  if (!vehicleToDelete.value) return
  isDeleting.value = true
  try {
    await vehicleService.remove(vehicleToDelete.value.id)
    vehicles.value = vehicles.value.filter((v) => v.id !== vehicleToDelete.value.id)
    if (editingVehicleId.value === vehicleToDelete.value.id) resetForm()
    toast.success('Veículo removido com sucesso!')
    closeConfirm()
  } catch (error) {
    const message = error.response?.data?.message ?? error.response?.data?.error ?? 'Não foi possível remover o veículo.'
    toast.error(message)
  } finally {
    isDeleting.value = false
  }
}

const MODEL_MAX_LENGTH = 40

const handleModelKeydown = (event) => {
  const allowedKeys = [
    'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight',
    'ArrowUp', 'ArrowDown', 'Tab', 'Home', 'End',
    'Enter', 'Escape',
  ]

  // permite atalhos (ctrl/cmd + a/c/v/x) e teclas de navegação
  if (event.ctrlKey || event.metaKey || allowedKeys.includes(event.key)) {
    return
  }

  const input = event.target
  const hasSelection = input.selectionStart !== input.selectionEnd

  // se já está no limite e não há seleção pra substituir, bloqueia a tecla
  if (form.model.length >= MODEL_MAX_LENGTH && !hasSelection) {
    event.preventDefault()
  }
}

const handleModelPaste = (event) => {
  event.preventDefault()
  const pasted = (event.clipboardData || window.clipboardData).getData('text')
  const input = event.target
  const start = input.selectionStart
  const end = input.selectionEnd

  const newValue = form.model.slice(0, start) + pasted + form.model.slice(end)
  form.model = newValue.slice(0, MODEL_MAX_LENGTH)
}
</script>

<template>
  <BaseModal :title="`Veículos de ${person.name}`" size="xl" @close="emit('close')">
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-ink-700">
            {{ isLoadingVehicles ? 'Carregando...' : `${vehicles.length} veículo(s)` }}
          </h3>
        </div>

        <div v-if="isLoadingVehicles" class="py-8 text-center text-sm text-ink-500">
          Carregando veículos...
        </div>

        <div
          v-else-if="!vehicles.length"
          class="flex flex-col items-center gap-2 rounded-xl border border-dashed border-surface-border py-8 text-center"
        >
          <Car :size="24" class="text-ink-300" />
          <p class="text-sm text-ink-500">Nenhum veículo cadastrado ainda.</p>
        </div>

        <div v-else class="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
          <div
            v-for="vehicle in vehicles"
            :key="vehicle.id"
            class="flex items-center justify-between rounded-xl border p-3 transition-colors"
            :class="editingVehicleId === vehicle.id ? 'border-brand-300 bg-brand-50' : 'border-surface-border bg-white'"
          >
            <div class="flex items-center gap-3">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-50 text-ink-500">
                <Car :size="16" />
              </div>
              <div>
                <p class="text-sm font-medium text-ink-900">{{ brandName(vehicle.brand_id) }} {{ vehicle.model }}</p>
                <p class="text-xs text-ink-500">{{ vehicle.license_plate }} · {{ vehicle.year }} · {{ vehicle.color }}</p>
              </div>
            </div>
            <div class="flex shrink-0 gap-1">
              <button
                type="button"
                class="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-brand-100 hover:text-brand-600"
                aria-label="Editar veículo"
                @click="selectForEdit(vehicle)"
              >
                <Pencil :size="14" />
              </button>
              <button
                type="button"
                class="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600"
                aria-label="Remover veículo"
                @click="askDeleteVehicle(vehicle)"
              >
                <Trash2 :size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-4 border-t border-surface-border pt-6 md:border-l md:border-t-0 md:pl-6 md:pt-0">
        <div class="flex items-center gap-2">
          <Tag :size="14" class="text-brand-600" />
          <h3 class="text-sm font-semibold text-ink-700">
            {{ isEditing ? 'Editar veículo' : 'Novo veículo' }}
          </h3>
        </div>

        <form class="flex flex-col gap-4" @submit.prevent="handleSubmit" novalidate>
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <label class="text-sm font-medium text-ink-700">Marca</label>
              <button
                v-if="!isCreatingBrand"
                type="button"
                class="flex items-center gap-1 text-xs font-medium text-brand-600 transition-colors hover:text-brand-700"
                @click="openBrandCreation"
              >
                <Plus :size="14" />
                Nova marca
              </button>
            </div>

            <select
              v-if="!isCreatingBrand"
              v-model="form.brand_id"
              class="rounded-xl border border-surface-border bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              :disabled="isLoadingBrands"
            >
              <option value="" disabled>{{ isLoadingBrands ? 'Carregando...' : 'Selecione' }}</option>
              <option v-for="brand in brands" :key="brand.id" :value="brand.id">
                {{ brand.name }}
              </option>
            </select>

            <div v-else class="flex items-center gap-2">
              <input
                ref="newBrandInputRef"
                v-model="newBrandName"
                type="text"
                placeholder="Nome da marca"
                class="flex-1 rounded-xl border border-surface-border bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                @keyup.enter="saveNewBrand"
              />
              <button
                type="button"
                class="shrink-0 rounded-xl bg-brand-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="isSavingBrand || !newBrandName.trim()"
                @click="saveNewBrand"
              >
                {{ isSavingBrand ? 'Salvando...' : 'Salvar' }}
              </button>
              <button
                type="button"
                class="shrink-0 rounded-xl p-2 text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-700"
                aria-label="Cancelar"
                :disabled="isSavingBrand"
                @click="cancelBrandCreation"
              >
                <X :size="16" />
              </button>
            </div>

            <span v-if="fieldErrors.brand_id" class="text-xs text-red-600">{{ fieldErrors.brand_id[0] }}</span>
          </div>

          <div class="flex flex-col gap-1.5">
            <BaseInput
              v-model="modelValue"
              label="Modelo"
              :icon="Car"
              placeholder="Ex: Civic"
              maxlength="40"
              @keydown="handleModelKeydown"
              @paste="handleModelPaste"
            />
            <span v-if="fieldErrors.model" class="text-xs text-red-600">{{ fieldErrors.model[0] }}</span>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <BaseInput
                v-model="form.year"
                label="Ano"
                :icon="Calendar"
                placeholder="2024"
                inputmode="numeric"
                maxlength="4"
              />
              <span v-if="fieldErrors.year" class="text-xs text-red-600">{{ fieldErrors.year[0] }}</span>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-ink-700">Cor</label>
              <select
                v-model="form.color"
                class="rounded-xl border border-surface-border bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="" disabled>Selecione</option>
                <option v-for="color in carColors" :key="color" :value="color">
                  {{ color }}
                </option>
              </select>
              <span v-if="fieldErrors.color" class="text-xs text-red-600">{{ fieldErrors.color[0] }}</span>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <BaseInput v-model="form.license_plate" label="Placa" :icon="Hash" placeholder="ABC1D23" />
            <span v-if="fieldErrors.license_plate" class="text-xs text-red-600">{{ fieldErrors.license_plate[0] }}</span>
          </div>

          <div class="mt-2 flex justify-end gap-3">
            <BaseButton v-if="isEditing" type="button" variant="ghost" @click="resetForm">
              Cancelar edição
            </BaseButton>
            <BaseButton type="submit" :disabled="isSubmitting">
              {{ isSubmitting ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Cadastrar' }}
            </BaseButton>
          </div>
        </form>
      </div>
    </div>

    <ConfirmModal
      v-if="isConfirmOpen"
      title="Remover veículo"
      :message="`Tem certeza que deseja remover o veículo ${vehicleToDelete?.model} (${vehicleToDelete?.license_plate})? Essa ação não pode ser desfeita.`"
      confirm-label="Remover"
      :is-loading="isDeleting"
      @close="closeConfirm"
      @confirm="confirmDeleteVehicle"
    />
  </BaseModal>
</template>