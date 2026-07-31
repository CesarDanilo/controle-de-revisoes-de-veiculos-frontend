<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { Car, Palette, Calendar, Hash, Plus, X, Pencil, Trash2, Tag, Loader2 } from '@lucide/vue'
import BaseModal from '../ui/BaseModal.vue'
import BaseInput from '../ui/BaseInput.vue'
import BaseButton from '../ui/BaseButton.vue'
import BaseSearchSelect from '../ui/BaseSearchSelect.vue'
import ConfirmModal from '../ui/ConfirmModal.vue'
import { vehicleSchema } from '../../schemas/vehicle.schema'
import { brandService } from '../../services/brand.service'
import { colorService } from '../../services/color.service'
import { vehicleService } from '../../services/vehicle.service'
import { useToast } from '../../composables/useToast'

const props = defineProps({
  person: { type: Object, required: true },
  highlightVehicleId: { type: [String, Number], default: null },
})

const emit = defineEmits(['close'])

const toast = useToast()

// 🔴 AQUI — controla se o painel de cadastro/edição está expandido; por padrão, começa fechado (só a lista)
const isFormOpen = ref(false)

const emptyForm = () => ({
  model: '',
  year: '',
  color_id: '',
  brand_id: '',
  license_plate: '',
  people_id: props.person.id,
})

const form = reactive(emptyForm())
const editingVehicleId = ref(null)

// snapshot normalizado do veículo original (usado pra detectar o que mudou)
const originalSnapshot = ref(null)

// 🔴 AQUI — snapshot bruto (sem validação) só pra controlar o estado do botão em tempo real
const originalRawSnapshot = ref(null)

const vehicles = ref([])
const isLoadingVehicles = ref(true)

const brands = ref([])
const isLoadingBrands = ref(true)

const colors = ref([])
const isLoadingColors = ref(true)

const fieldErrors = ref({})
const isSubmitting = ref(false)

const isCreatingBrand = ref(false)
const newBrandName = ref('')
const isSavingBrand = ref(false)
const newBrandInputRef = ref(null)

const isCreatingColor = ref(false)
const newColorName = ref('')
const isSavingColor = ref(false)
const newColorInputRef = ref(null)

const isConfirmOpen = ref(false)
const vehicleToDelete = ref(null)
const isDeleting = ref(false)

const isEditing = computed(() => editingVehicleId.value !== null)

// 🔴 AQUI — true quando está editando e nenhum campo foi alterado ainda
const isUnchanged = computed(() => {
  if (!isEditing.value || !originalRawSnapshot.value) return false

  const currentRaw = JSON.stringify({
    model: form.model,
    year: form.year,
    color_id: form.color_id,
    brand_id: form.brand_id,
    license_plate: form.license_plate,
  })

  return currentRaw === originalRawSnapshot.value
})

const brandName = (brandId) => brands.value.find((b) => b.id === brandId)?.name ?? '—'
const colorName = (colorId) => colors.value.find((c) => c.id === colorId)?.name ?? '—'

// lista ordenada alfabeticamente pro select, sem alterar a ordem original em colors.value
const sortedColors = computed(() =>
  [...colors.value].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
)

// getter/setter com bloqueio real de caracteres (não só maxlength visual)
const modelValue = computed({
  get: () => form.model,
  set: (value) => {
    form.model = value.slice(0, 40)
  },
})

onMounted(async () => {
  isLoadingBrands.value = true
  isLoadingColors.value = true
  isLoadingVehicles.value = true
  try {
    const [brandsList, colorsList, vehiclesList] = await Promise.all([
      brandService.list(),
      colorService.list(),
      vehicleService.list(),
    ])
    brands.value = brandsList
    colors.value = colorsList
    vehicles.value = vehiclesList.filter((v) => v.people_id === props.person.id)

    if (props.highlightVehicleId) {
      const target = vehicles.value.find(
        (v) => String(v.id) === String(props.highlightVehicleId)
      )
      if (target) selectForEdit(target)
    }
  } finally {
    isLoadingBrands.value = false
    isLoadingColors.value = false
    isLoadingVehicles.value = false
  }
})

const resetForm = () => {
  Object.assign(form, emptyForm())
  editingVehicleId.value = null
  originalSnapshot.value = null
  originalRawSnapshot.value = null // 🔴 AQUI
  fieldErrors.value = {}
}

// 🔴 AQUI — abre o painel já pronto pra um novo cadastro
const openCreateForm = () => {
  resetForm()
  isFormOpen.value = true
}

// 🔴 AQUI — fecha o painel e volta pra listagem, limpando qualquer edição/criação em andamento
const closeForm = () => {
  resetForm()
  isFormOpen.value = false
}

const selectForEdit = (vehicle) => {
  form.model = vehicle.model
  form.year = String(vehicle.year)
  form.color_id = vehicle.color_id
  form.brand_id = vehicle.brand_id
  form.license_plate = vehicle.license_plate
  form.people_id = props.person.id
  editingVehicleId.value = vehicle.id
  fieldErrors.value = {}
  isFormOpen.value = true // 🔴 AQUI — editar sempre expande o painel

  // normaliza o estado original pelo mesmo schema, pra comparar "de igual pra igual" depois
  const parsed = vehicleSchema.safeParse(form)
  originalSnapshot.value = parsed.success ? parsed.data : null

  // 🔴 AQUI — snapshot bruto do formulário logo após popular os campos, usado pro botão
  originalRawSnapshot.value = JSON.stringify({
    model: form.model,
    year: form.year,
    color_id: form.color_id,
    brand_id: form.brand_id,
    license_plate: form.license_plate,
  })
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

// 🔴 AQUI — limite de caracteres pro nome da marca
const BRAND_NAME_MAX_LENGTH = 30

// 🔴 AQUI — bloqueio de digitação ao atingir o limite (mesmo padrão do Modelo)
const handleBrandNameKeydown = (event) => {
  const allowedKeys = [
    'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight',
    'ArrowUp', 'ArrowDown', 'Tab', 'Home', 'End',
    'Enter', 'Escape',
  ]

  if (event.ctrlKey || event.metaKey || allowedKeys.includes(event.key)) {
    return
  }

  const input = event.target
  const hasSelection = input.selectionStart !== input.selectionEnd

  if (newBrandName.value.length >= BRAND_NAME_MAX_LENGTH && !hasSelection) {
    event.preventDefault()
  }
}

// 🔴 AQUI — trunca em caso de colar texto grande (Ctrl+V)
const handleBrandNamePaste = (event) => {
  event.preventDefault()
  const pasted = (event.clipboardData || window.clipboardData).getData('text')
  const input = event.target
  const start = input.selectionStart
  const end = input.selectionEnd

  const newValue = newBrandName.value.slice(0, start) + pasted + newBrandName.value.slice(end)
  newBrandName.value = newValue.slice(0, BRAND_NAME_MAX_LENGTH)
}

const saveNewBrand = async () => {
  const name = newBrandName.value.toUpperCase().trim()
  if (!name) return

  // 🔴 AQUI — checagem local: já existe marca com esse nome na lista carregada?
  // Evita a chamada de API e dá feedback instantâneo, sem esperar o backend.
  const alreadyExists = brands.value.some((b) => b.name.toUpperCase().trim() === name)
  if (alreadyExists) {
    toast.error('Essa marca já está cadastrada.')
    return
  }

  isSavingBrand.value = true
  try {
    const brand = await brandService.create({ name })
    brands.value.push(brand)
    form.brand_id = brand.id
    toast.success('Marca cadastrada com sucesso!')
    cancelBrandCreation()
  } catch (error) {
    // 🔴 AQUI — feedback mais claro caso o backend acuse duplicidade
    // (cobre o caso de outra pessoa ter cadastrado a mesma marca entre o
    // carregamento da lista e esse submit — condição de corrida)
    const rawMessage = error.response?.data?.message ?? error.response?.data?.error
    const message = rawMessage?.includes('already been taken')
      ? 'Essa marca já está cadastrada.'
      : (rawMessage ?? 'Não foi possível cadastrar a marca.')
    toast.error(message)
  } finally {
    isSavingBrand.value = false
  }
}

// ---- Criação de cor (mesmo padrão da criação de marca) ----
const openColorCreation = async () => {
  isCreatingColor.value = true
  newColorName.value = ''
  await nextTick()
  newColorInputRef.value?.focus()
}

const cancelColorCreation = () => {
  isCreatingColor.value = false
  newColorName.value = ''
}

const COLOR_NAME_MAX_LENGTH = 30

const handleColorNameKeydown = (event) => {
  const allowedKeys = [
    'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight',
    'ArrowUp', 'ArrowDown', 'Tab', 'Home', 'End',
    'Enter', 'Escape',
  ]

  if (event.ctrlKey || event.metaKey || allowedKeys.includes(event.key)) {
    return
  }

  const input = event.target
  const hasSelection = input.selectionStart !== input.selectionEnd

  if (newColorName.value.length >= COLOR_NAME_MAX_LENGTH && !hasSelection) {
    event.preventDefault()
  }
}

const handleColorNamePaste = (event) => {
  event.preventDefault()
  const pasted = (event.clipboardData || window.clipboardData).getData('text')
  const input = event.target
  const start = input.selectionStart
  const end = input.selectionEnd

  const newValue = newColorName.value.slice(0, start) + pasted + newColorName.value.slice(end)
  newColorName.value = newValue.slice(0, COLOR_NAME_MAX_LENGTH)
}

const saveNewColor = async () => {
  const name = newColorName.value.trim()
  if (!name) return

  // checagem local: já existe cor com esse nome na lista carregada?
  const alreadyExists = colors.value.some((c) => c.name.toUpperCase().trim() === name.toUpperCase())
  if (alreadyExists) {
    toast.error('Essa cor já está cadastrada.')
    return
  }

  isSavingColor.value = true
  try {
    const color = await colorService.create({ name })
    colors.value.push(color)
    form.color_id = color.id
    toast.success('Cor cadastrada com sucesso!')
    cancelColorCreation()
  } catch (error) {
    const rawMessage = error.response?.data?.message ?? error.response?.data?.error
    const message = rawMessage?.includes('already been taken')
      ? 'Essa cor já está cadastrada.'
      : (rawMessage ?? 'Não foi possível cadastrar a cor.')
    toast.error(message)
  } finally {
    isSavingColor.value = false
  }
}
// ------------------------------------------------------------

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
      resetForm() // 🔴 AQUI — limpa e volta pro modo criação, mas o painel continua aberto
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
    resetForm() // 🔴 AQUI — limpa o formulário, mas o painel continua aberto pra um novo cadastro
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

// 🔴 AQUI — computeds pro contador de caracteres (Modelo, Nova marca e Nova cor)
const modelCharCount = computed(() => form.model.length)
const brandNameCharCount = computed(() => newBrandName.value.length)
const colorNameCharCount = computed(() => newColorName.value.length)

const isLetter = (char) => /^[A-Za-z]$/.test(char)
const isDigit = (char) => /^[0-9]$/.test(char)

const YEAR_MAX_LENGTH = 4

// filtra e formata um valor completo de ano (usado no v-model e no paste)
const formatYear = (value) => {
  return value.replace(/\D/g, '').slice(0, YEAR_MAX_LENGTH)
}

const yearValue = computed({
  get: () => form.year,
  set: (value) => {
    form.year = formatYear(value)
  },
})

const handleYearKeydown = (event) => {
  const allowedKeys = [
    'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight',
    'ArrowUp', 'ArrowDown', 'Tab', 'Home', 'End',
    'Enter', 'Escape',
  ]

  if (event.ctrlKey || event.metaKey || allowedKeys.includes(event.key)) {
    return
  }

  // ignora teclas especiais (Shift, CapsLock, F1 etc.)
  if (event.key.length !== 1) {
    return
  }

  // bloqueia qualquer coisa que não seja dígito
  if (!isDigit(event.key)) {
    event.preventDefault()
    return
  }

  const input = event.target
  const hasSelection = input.selectionStart !== input.selectionEnd

  // já está no limite e não há seleção pra substituir: bloqueia
  if (form.year.length >= YEAR_MAX_LENGTH && !hasSelection) {
    event.preventDefault()
  }
}

const handleYearPaste = (event) => {
  event.preventDefault()
  const pasted = (event.clipboardData || window.clipboardData).getData('text')
  const input = event.target
  const start = input.selectionStart
  const end = input.selectionEnd

  const newValue = form.year.slice(0, start) + pasted + form.year.slice(end)
  form.year = formatYear(newValue)
}

const LICENSE_PLATE_MAX_LENGTH = 7

// define o tipo de caractere aceito em cada posição da placa
const licensePlateCharAllowed = (position, char) => {
  if (position <= 2) return isLetter(char) // ABC
  if (position === 3) return isDigit(char) // 1
  if (position === 4) return isLetter(char) || isDigit(char) // D (Mercosul) ou 2 (antigo)
  return isDigit(char) // 23
}

// filtra e formata um valor completo (usado no v-model e no paste)
const formatLicensePlate = (value) => {
  const upper = value.toUpperCase()
  let result = ''
  for (let i = 0; i < upper.length && result.length < LICENSE_PLATE_MAX_LENGTH; i++) {
    const char = upper[i]
    if (licensePlateCharAllowed(result.length, char)) {
      result += char
    }
  }
  return result
}

const licensePlateValue = computed({
  get: () => form.license_plate,
  set: (value) => {
    form.license_plate = formatLicensePlate(value)
  },
})

const handleLicensePlateKeydown = (event) => {
  const allowedKeys = [
    'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight',
    'ArrowUp', 'ArrowDown', 'Tab', 'Home', 'End',
    'Enter', 'Escape',
  ]

  if (event.ctrlKey || event.metaKey || allowedKeys.includes(event.key)) {
    return
  }

  // ignora teclas especiais (Shift, CapsLock, F1 etc.)
  if (event.key.length !== 1) {
    return
  }

  const input = event.target
  const hasSelection = input.selectionStart !== input.selectionEnd

  // já está no limite e não há seleção pra substituir: bloqueia
  if (form.license_plate.length >= LICENSE_PLATE_MAX_LENGTH && !hasSelection) {
    event.preventDefault()
    return
  }

  // bloqueia se o caractere não é do tipo esperado pra posição atual
  const caretPosition = input.selectionStart
  if (!licensePlateCharAllowed(caretPosition, event.key)) {
    event.preventDefault()
  }
}

const handleLicensePlatePaste = (event) => {
  event.preventDefault()
  const pasted = (event.clipboardData || window.clipboardData).getData('text')
  const input = event.target
  const start = input.selectionStart
  const end = input.selectionEnd

  const newValue = form.license_plate.slice(0, start) + pasted + form.license_plate.slice(end)
  form.license_plate = formatLicensePlate(newValue)
}
</script>

<template>
  <BaseModal :title="`Veículos de ${person.name}`" size="xl" @close="emit('close')">
    <div class="grid grid-cols-1 gap-6" :class="isFormOpen ? 'md:grid-cols-2' : ''">
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-ink-700">
            {{ isLoadingVehicles ? 'Carregando...' : `${vehicles.length} veículo(s)` }}
          </h3>
          <!-- 🔴 AQUI — botão só aparece com a lista sozinha (painel fechado) -->
          <BaseButton v-if="!isFormOpen" type="button" @click="openCreateForm">
            <Plus :size="16" />
            Adicionar veículo
          </BaseButton>
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
                <p class="text-xs text-ink-500">{{ vehicle.license_plate }} · {{ vehicle.year }} · {{ colorName(vehicle.color_id) }}</p>
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

      <!-- 🔴 AQUI — painel de cadastro/edição só é renderizado quando isFormOpen é true -->
      <div
        v-if="isFormOpen"
        class="flex flex-col gap-4 border-t border-surface-border pt-6 md:border-l md:border-t-0 md:pl-6 md:pt-0"
      >
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

            <BaseSearchSelect
              v-if="!isCreatingBrand"
              v-model="form.brand_id"
              :options="brands"
              :loading="isLoadingBrands"
              loading-text="Carregando..."
              placeholder="Selecione"
              search-placeholder="Pesquisar marca..."
              empty-text="Nenhuma marca encontrada."
              search-max-length=30
            />

            <div v-else class="flex flex-col gap-1">
              <div class="flex items-center gap-2">
                <input
                  ref="newBrandInputRef"
                  v-model="newBrandName"
                  type="text"
                  placeholder="Nome da marca"
                  class="flex-1 rounded-xl border border-surface-border bg-white px-3 py-2.5 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  :maxlength="BRAND_NAME_MAX_LENGTH"
                  @keydown.enter="saveNewBrand"
                  @keydown="handleBrandNameKeydown"
                  @paste="handleBrandNamePaste"
                />
                <button
                  type="button"
                  class="shrink-0 rounded-xl bg-brand-600 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="isSavingBrand || !newBrandName.trim()"
                  @click="saveNewBrand"
                >
                  {{ isSavingBrand ? 'Salvando...' : 'Salvar' }}
                </button>
                <button
                  type="button"
                  class="shrink-0 rounded-xl p-2.5 text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-700"
                  aria-label="Cancelar"
                  :disabled="isSavingBrand"
                  @click="cancelBrandCreation"
                >
                  <X :size="16" />
                </button>
              </div>
              <span
                class="self-end text-xs"
                :class="brandNameCharCount >= BRAND_NAME_MAX_LENGTH ? 'text-red-500' : 'text-ink-400'"
              >
                {{ brandNameCharCount }}/{{ BRAND_NAME_MAX_LENGTH }}
              </span>
            </div>

            <span v-if="fieldErrors.brand_id" class="text-xs text-red-600">{{ fieldErrors.brand_id[0] }}</span>
          </div>

          <div class="flex flex-col gap-1.5">
            <BaseInput
              v-model="modelValue"
              label="Modelo"
              :icon="Car"
              placeholder="Ex: Civic"
              :maxlength="MODEL_MAX_LENGTH"
              @keydown="handleModelKeydown"
              @paste="handleModelPaste"
            />
            <div class="flex items-center justify-between">
              <span v-if="fieldErrors.model" class="text-xs text-red-600">{{ fieldErrors.model[0] }}</span>
              <span v-else></span>
              <span
                class="text-xs"
                :class="modelCharCount >= MODEL_MAX_LENGTH ? 'text-red-500' : 'text-ink-400'"
              >
                {{ modelCharCount }}/{{ MODEL_MAX_LENGTH }}
              </span>
            </div>
          </div>

          <div class="grid grid-cols-5 gap-3">
            <div class="col-span-2 flex flex-col gap-1.5">
              <BaseInput
                v-model="yearValue"
                label="Ano"
                :icon="Calendar"
                placeholder="2024"
                inputmode="numeric"
                maxlength="4"
                @keydown="handleYearKeydown"
                @paste="handleYearPaste"
              />
              <span v-if="fieldErrors.year" class="text-xs text-red-600">{{ fieldErrors.year[0] }}</span>
            </div>

            <div class="col-span-3 flex flex-col gap-1.5">
              <div class="flex items-center justify-between">
                <label class="text-sm font-medium text-ink-700">Cor</label>
                <button
                  v-if="!isCreatingColor"
                  type="button"
                  class="flex items-center gap-1 text-xs font-medium text-brand-600 transition-colors hover:text-brand-700"
                  @click="openColorCreation"
                >
                  <Plus :size="14" />
                  Nova cor
                </button>
              </div>

              <BaseSearchSelect
                v-if="!isCreatingColor"
                v-model="form.color_id"
                :options="sortedColors"
                :loading="isLoadingColors"
                loading-text="Carregando..."
                placeholder="Selecione"
                search-placeholder="Pesquisar cor..."
                empty-text="Nenhuma cor encontrada."
              />

              <div v-else class="flex flex-col gap-1">
                <div class="flex items-center gap-1.5">
                  <input
                    ref="newColorInputRef"
                    v-model="newColorName"
                    type="text"
                    placeholder="Nome da cor"
                    class="min-w-0 flex-1 rounded-xl border border-surface-border bg-white px-2 py-2.5 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    :maxlength="COLOR_NAME_MAX_LENGTH"
                    @keydown.enter="saveNewColor"
                    @keydown="handleColorNameKeydown"
                    @paste="handleColorNamePaste"
                  />
                  <button
                    type="button"
                    class="shrink-0 rounded-xl bg-brand-600 p-2.5 text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Salvar cor"
                    :disabled="isSavingColor || !newColorName.trim()"
                    @click="saveNewColor"
                  >
                    <Loader2 v-if="isSavingColor" :size="16" class="animate-spin" />
                    <Plus v-else :size="16" />
                  </button>
                  <button
                    type="button"
                    class="shrink-0 rounded-xl p-2.5 text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-700"
                    aria-label="Cancelar"
                    :disabled="isSavingColor"
                    @click="cancelColorCreation"
                  >
                    <X :size="16" />
                  </button>
                </div>
                <span
                  class="self-end text-xs"
                  :class="colorNameCharCount >= COLOR_NAME_MAX_LENGTH ? 'text-red-500' : 'text-ink-400'"
                >
                  {{ colorNameCharCount }}/{{ COLOR_NAME_MAX_LENGTH }}
                </span>
              </div>

              <span v-if="fieldErrors.color_id" class="text-xs text-red-600">{{ fieldErrors.color_id[0] }}</span>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <BaseInput
              v-model="licensePlateValue"
              label="Placa"
              :icon="Hash"
              placeholder="ABC1234 ou ABC1D23"
              maxlength="7"
              @keydown="handleLicensePlateKeydown"
              @paste="handleLicensePlatePaste"
            />
            <span v-if="fieldErrors.license_plate" class="text-xs text-red-600">{{ fieldErrors.license_plate[0] }}</span>
          </div>

          <div class="mt-2 flex justify-end gap-3">
            <!-- 🔴 AQUI — sempre visível com o painel aberto, tanto em criação quanto edição -->
            <BaseButton type="button" variant="ghost" @click="closeForm">
              {{ isEditing ? 'Cancelar edição' : 'Cancelar' }}
            </BaseButton>
            <BaseButton type="submit" :disabled="isSubmitting || isUnchanged">
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