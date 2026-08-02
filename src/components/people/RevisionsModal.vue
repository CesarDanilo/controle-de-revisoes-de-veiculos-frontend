<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { Car, Wrench, Plus, X, Loader2, AlertCircle, Pencil, Trash2 } from '@lucide/vue'
import BaseModal from '../ui/BaseModal.vue'
import ConfirmModal from '../ui/ConfirmModal.vue'
import { vehicleService } from '../../services/vehicle.service'
import { revisionService } from '../../services/revision.service'
import { useToast } from '../../composables/useToast'

const props = defineProps({
  person: { type: Object, required: true },
  highlightVehicleId: { type: [String, Number], default: null },
  highlightRevisionId: { type: [String, Number], default: null },
})

const emit = defineEmits(['close', 'register-vehicle'])

const toast = useToast()

const vehicles = ref([])
const revisionsByVehicle = reactive({})
const isLoading = ref(true)

const openFormVehicleId = ref(null)
const formMode = ref('create')
const editingRevisionId = ref(null)
const isSubmitting = ref(false)
const formError = ref('')

const editingRevisionLabel = ref('')

const descriptionInputRefs = ref({})
const setDescriptionInputRef = (vehicleId) => (el) => {
  descriptionInputRefs.value[vehicleId] = el
}

const formRefs = ref({})
const setFormRef = (vehicleId) => (el) => {
  formRefs.value[vehicleId] = el
}

const DESCRIPTION_MAX_LENGTH = 150

const MAX_YEARS_AHEAD = 5

const STATUS_OPTIONS = [
  { value: 'aberto', label: 'Aberto' },
  { value: 'em_andamento', label: 'Em/Andamento' },
  { value: 'aguardando_pagamento', label: 'Aguar/Pagamento' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'cancelado', label: 'Cancelado' },
]

const statusOptionsForForm = computed(() =>
  formMode.value === 'create'
    ? STATUS_OPTIONS.filter((option) => option.value !== 'cancelado')
    : STATUS_OPTIONS
)

const STATUS_PAGAMENTO_OPTIONS = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'pago', label: 'Pago' },
]

const STATUS_BADGE_CLASSES = {
  aberto: 'bg-blue-50 text-blue-700 border-blue-200',
  em_andamento: 'bg-amber-50 text-amber-700 border-amber-200',
  aguardando_pagamento: 'bg-orange-50 text-orange-700 border-orange-200',
  concluido: 'bg-green-50 text-green-700 border-green-200',
  cancelado: 'bg-ink-100 text-ink-500 border-ink-200',
}

const STATUS_PAGAMENTO_BADGE_CLASSES = {
  pendente: 'bg-amber-50 text-amber-700 border-amber-200',
  pago: 'bg-green-50 text-green-700 border-green-200',
}

const statusLabel = (value) => STATUS_OPTIONS.find((o) => o.value === value)?.label || '—'
const statusPagamentoLabel = (value) =>
  STATUS_PAGAMENTO_OPTIONS.find((o) => o.value === value)?.label || '—'

const emptyFieldErrors = () => ({
  description: '',
  revision_date: '',
  cost: '',
  next_revision_date: '',
  next_revision_km: '',
})
const fieldErrors = reactive(emptyFieldErrors())

const emptyForm = () => ({
  description: '',
  revision_date: new Date().toISOString().slice(0, 10),
  km: null,
  cost: 0,
  next_revision_date: '',
  next_revision_km: null,
  status: 'aberto',
  status_pagamento: 'pendente',
})
const formData = reactive(emptyForm())

const originalSnapshot = ref(null)

const originalStatusSnapshot = ref(null)

const hasChanges = computed(() => {
  if (formMode.value !== 'edit') return true
  if (!originalSnapshot.value) return true

  const comparable = buildComparablePayload()
  const regularChanged = Object.keys(comparable).some(
    (key) => comparable[key] !== originalSnapshot.value[key]
  )

  const statusChanged =
    !!originalStatusSnapshot.value &&
    (formData.status !== originalStatusSnapshot.value.status ||
      formData.status_pagamento !== originalStatusSnapshot.value.status_pagamento)

  return regularChanged || statusChanged
})

const revisionToDelete = ref(null)
const deletingRevisionId = ref(null)
const deleteErrorByVehicle = reactive({})

const todayISO = () => new Date().toLocaleDateString('sv-SE')

const minNextRevisionDate = computed(() => {
  if (!formData.revision_date) return undefined
  const d = new Date(`${formData.revision_date}T00:00:00`)
  d.setDate(d.getDate() + 1)
  return d.toLocaleDateString('sv-SE')
})

const maxNextRevisionDate = computed(() => {
  const d = new Date()
  d.setFullYear(d.getFullYear() + MAX_YEARS_AHEAD)
  return d.toLocaleDateString('sv-SE')
})

const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  const isoPart = String(dateStr).slice(0, 10)
  const match = isoPart.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return dateStr
  const [, year, month, day] = match
  return `${day}/${month}/${year}`
}

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === '') return '—'
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const isOverdue = (dateStr) => {
  if (!dateStr) return false
  return String(dateStr).slice(0, 10) < todayISO()
}

const sortRevisions = (list) =>
  [...list].sort((a, b) => new Date(b.revision_date) - new Date(a.revision_date))

const visibleRevisions = (vehicleId) => {
  const list = revisionsByVehicle[vehicleId] || []
  if (formMode.value === 'edit' && openFormVehicleId.value === vehicleId && editingRevisionId.value) {
    return list.filter((r) => r.id !== editingRevisionId.value)
  }
  return list
}

// 🔴 AQUI — total de revisões somando todos os veículos da pessoa, usado
// pra decidir se o formulário deve abrir sozinho ao carregar o modal
const totalRevisionsCount = computed(() =>
  vehicles.value.reduce((sum, vehicle) => sum + (revisionsByVehicle[vehicle.id]?.length || 0), 0)
)

const MAX_KM_DIGITS = 7

const formatKmDigits = (digits) => {
  if (!digits) return ''
  return Number(digits).toLocaleString('pt-BR')
}

function makeKmModel(fieldKey) {
  return computed({
    get() {
      const value = formData[fieldKey]
      if (value === null || value === undefined || value === '') return ''
      return formatKmDigits(String(value))
    },
    set(val) {
      if (fieldErrors[fieldKey] !== undefined) fieldErrors[fieldKey] = ''
      const digits = val.replace(/\D/g, '').slice(0, MAX_KM_DIGITS)
      formData[fieldKey] = digits ? Number(digits) : null
    },
  })
}

const kmModel = makeKmModel('km')
const nextRevisionKmModel = makeKmModel('next_revision_km')

function blockKmOverflow(e) {
  const controlKeys = [
    'Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight',
    'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter',
  ]
  if (controlKeys.includes(e.key)) return
  if (e.ctrlKey || e.metaKey) return

  if (!/^\d$/.test(e.key)) {
    e.preventDefault()
    return
  }

  const target = e.target
  const hasSelection = target.selectionStart !== target.selectionEnd
  if (hasSelection) return

  const currentDigits = target.value.replace(/\D/g, '')
  if (currentDigits.length >= MAX_KM_DIGITS) {
    e.preventDefault()
  }
}

function makeBlockKmPaste(kmModelRef) {
  return function (e) {
    e.preventDefault()
    const pasted = (e.clipboardData || window.clipboardData).getData('text')
    const digitsOnly = pasted.replace(/\D/g, '')
    if (!digitsOnly) return

    const target = e.target
    const currentDigits = kmModelRef.value.replace(/\D/g, '')
    const start = target.selectionStart
    const end = target.selectionEnd

    const beforeCursorDigits = currentDigits.slice(0, start)
    const afterCursorDigits = currentDigits.slice(end)
    const merged = (beforeCursorDigits + digitsOnly + afterCursorDigits).slice(0, MAX_KM_DIGITS)

    kmModelRef.value = merged
  }
}

const blockKmPaste = makeBlockKmPaste(kmModel)
const blockNextRevisionKmPaste = makeBlockKmPaste(nextRevisionKmModel)

const MAX_COST_DIGITS = 8

const costModel = computed({
  get() {
    if (formData.cost === null || formData.cost === undefined || formData.cost === '') return ''
    return Number(formData.cost).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  },
  set(val) {
    fieldErrors.cost = ''
    const digits = val.replace(/\D/g, '').slice(0, MAX_COST_DIGITS)
    if (!digits) {
      formData.cost = null
      return
    }
    formData.cost = Number(digits) / 100
  },
})

function blockCostOverflow(e) {
  const controlKeys = [
    'Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight',
    'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter',
  ]
  if (controlKeys.includes(e.key)) return
  if (e.ctrlKey || e.metaKey) return

  if (!/^\d$/.test(e.key)) {
    e.preventDefault()
    return
  }

  const target = e.target
  const hasSelection = target.selectionStart !== target.selectionEnd
  if (hasSelection) return

  const currentDigits = target.value.replace(/\D/g, '')
  if (currentDigits.length >= MAX_COST_DIGITS) {
    e.preventDefault()
  }
}

function blockCostPaste(e) {
  e.preventDefault()
  const pasted = (e.clipboardData || window.clipboardData).getData('text')
  const digitsOnly = pasted.replace(/\D/g, '')
  if (!digitsOnly) return

  const target = e.target
  const currentDigits = costModel.value.replace(/\D/g, '')
  const start = target.selectionStart
  const end = target.selectionEnd

  const beforeCursorDigits = currentDigits.slice(0, start)
  const afterCursorDigits = currentDigits.slice(end)
  const merged = (beforeCursorDigits + digitsOnly + afterCursorDigits).slice(0, MAX_COST_DIGITS)

  costModel.value = merged
}

const FIELD_LABELS = {
  description: 'Descrição',
  revision_date: 'Data da revisão',
  km: 'KM',
  cost: 'Custo',
  next_revision_date: 'Próxima revisão (data)',
  next_revision_km: 'Próxima revisão (KM)',
  vehicle_id: 'Veículo',
  status: 'Status',
  status_pagamento: 'Status de pagamento',
}

function translateValidationMessage(field, message) {
  const label = FIELD_LABELS[field] || field

  if (/must be a date after/i.test(message)) {
    return `${label}: deve ser uma data posterior à data da revisão atual.`
  }
  if (/must be a date after or equal to/i.test(message)) {
    return `${label}: deve ser uma data igual ou posterior à data da revisão atual.`
  }
  if (/must be a valid date|must be a date/i.test(message)) {
    return `${label}: deve ser uma data válida.`
  }
  if (/field is required/i.test(message)) {
    return `${label}: campo obrigatório.`
  }
  if (/must be a number/i.test(message)) {
    return `${label}: deve ser um número.`
  }
  if (/must be at least/i.test(message)) {
    return `${label}: valor abaixo do mínimo permitido.`
  }
  if (/may not be greater than|must not be greater than/i.test(message)) {
    return `${label}: valor acima do máximo permitido.`
  }
  if (/must be greater than/i.test(message)) {
    return `${label}: deve ser maior que o valor de referência.`
  }
  if (/is invalid|invalid selected|selected .* is invalid/i.test(message)) {
    return `${label}: valor inválido.`
  }

  return `${label}: ${message}`
}

function translateValidationErrors(validationErrors) {
  return Object.entries(validationErrors)
    .flatMap(([field, messages]) => messages.map((msg) => translateValidationMessage(field, msg)))
    .join(' ')
}

function buildComparablePayload() {
  return {
    description: formData.description.trim(),
    revision_date: formData.revision_date,
    km: formData.km || null,
    cost: formData.cost ?? 0,
    next_revision_date: formData.next_revision_date || null,
    next_revision_km: formData.next_revision_km || null,
  }
}

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

      const scoped = list.filter((revision) => revision.vehicle_id === vehicle.id)

      revisionsByVehicle[vehicle.id] = sortRevisions(scoped)
    })
  } finally {
    isLoading.value = false
  }
}

const openHighlightedForEdit = () => {
  if (!props.highlightRevisionId) return

  let targetVehicleId = null
  let targetRevision = null

  for (const vehicle of vehicles.value) {
    const list = revisionsByVehicle[vehicle.id] || []
    const found = list.find((r) => r.id === props.highlightRevisionId)
    if (found) {
      targetVehicleId = vehicle.id
      targetRevision = found
      break
    }
  }

  if (!targetRevision) return

  startEdit(targetVehicleId, targetRevision)

  nextTick(() => {
    setTimeout(() => {
      formRefs.value[targetVehicleId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
  })
}

// 🔴 AQUI — mesma lógica usada no cadastro de veículos: se não há nenhuma
// revisão cadastrada (em nenhum veículo da pessoa), abre o formulário de
// criação direto no primeiro veículo, pra já pedir o preenchimento
const openCreateFormIfEmpty = () => {
  if (props.highlightRevisionId) return
  if (!vehicles.value.length) return
  if (totalRevisionsCount.value > 0) return

  const firstVehicleId = vehicles.value[0].id
  toggleForm(firstVehicleId)

  nextTick(() => {
    setTimeout(() => {
      formRefs.value[firstVehicleId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
  })
}

const openFormKey = computed(() => {
  if (openFormVehicleId.value === null) return null
  return `${openFormVehicleId.value}:${formMode.value}:${editingRevisionId.value}`
})

watch(openFormKey, (key) => {
  if (key === null) return
  setTimeout(() => {
    descriptionInputRefs.value[openFormVehicleId.value]?.focus()
  }, 80)
}, { flush: 'post' })

const toggleForm = (vehicleId) => {
  if (openFormVehicleId.value === vehicleId && formMode.value === 'create') {
    closeForm()
    return
  }
  openFormVehicleId.value = vehicleId
  formMode.value = 'create'
  editingRevisionId.value = null
  editingRevisionLabel.value = ''
  formError.value = ''
  Object.assign(fieldErrors, emptyFieldErrors())
  originalSnapshot.value = null
  originalStatusSnapshot.value = null
  Object.assign(formData, emptyForm())
}

const startEdit = (vehicleId, revision) => {
  revisionToDelete.value = null
  openFormVehicleId.value = vehicleId
  formMode.value = 'edit'
  editingRevisionId.value = revision.id
  editingRevisionLabel.value = `${revision.description || 'Revisão sem descrição'} · ${formatDate(revision.revision_date)}`
  formError.value = ''
  Object.assign(fieldErrors, emptyFieldErrors())
  Object.assign(formData, {
    description: revision.description || '',
    revision_date: revision.revision_date ? revision.revision_date.slice(0, 10) : '',
    km: revision.km !== null && revision.km !== undefined && revision.km !== '' ? Number(revision.km) : null,
    cost:
      revision.cost !== null && revision.cost !== undefined && revision.cost !== ''
        ? Number(revision.cost)
        : 0,
    next_revision_date: revision.next_revision_date ? revision.next_revision_date.slice(0, 10) : '',
    next_revision_km:
      revision.next_revision_km !== null &&
      revision.next_revision_km !== undefined &&
      revision.next_revision_km !== ''
        ? Number(revision.next_revision_km)
        : null,
    status: revision.status || 'aberto',
    status_pagamento: revision.status_pagamento || 'pendente',
  })

  originalSnapshot.value = buildComparablePayload()
  originalStatusSnapshot.value = {
    status: formData.status,
    status_pagamento: formData.status_pagamento,
  }
}

const closeForm = () => {
  openFormVehicleId.value = null
  formMode.value = 'create'
  editingRevisionId.value = null
  editingRevisionLabel.value = ''
  formError.value = ''
  Object.assign(fieldErrors, emptyFieldErrors())
  originalSnapshot.value = null
  originalStatusSnapshot.value = null
}

const submitRevision = async (vehicle) => {
  formError.value = ''
  Object.assign(fieldErrors, emptyFieldErrors())

  if (!vehicle?.id) {
    formError.value = 'Veículo inválido (ID não encontrado).'
    return
  }

  let hasError = false

  if (!formData.description.trim()) {
    fieldErrors.description = 'Informe uma descrição para a revisão.'
    hasError = true
  }
  if (!formData.revision_date) {
    fieldErrors.revision_date = 'Informe a data em que a revisão atual foi realizada.'
    hasError = true
  }
  if (formData.cost === null || formData.cost === undefined || formData.cost === '') {
    fieldErrors.cost = 'Informe o custo do serviço. Se foi gratuito, informe 0,00.'
    hasError = true
  } else if (Number(formData.cost) < 0) {
    fieldErrors.cost = 'O custo não pode ser negativo.'
    hasError = true
  }
  if (
    formData.next_revision_date &&
    formData.revision_date &&
    new Date(formData.next_revision_date) <= new Date(formData.revision_date)
  ) {
    fieldErrors.next_revision_date =
      'A data da próxima revisão deve ser posterior à data da revisão atual (não pode ser igual).'
    hasError = true
  } else if (
    formData.next_revision_date &&
    formData.next_revision_date > maxNextRevisionDate.value
  ) {
    fieldErrors.next_revision_date = `A data da próxima revisão não pode ultrapassar ${MAX_YEARS_AHEAD} anos a partir de hoje.`
    hasError = true
  }
  if (
    formData.next_revision_km !== null &&
    formData.next_revision_km !== '' &&
    formData.km !== null &&
    formData.km !== '' &&
    Number(formData.next_revision_km) <= Number(formData.km)
  ) {
    fieldErrors.next_revision_km = 'O KM da próxima revisão deve ser maior que o KM da revisão atual.'
    hasError = true
  }

  if (hasError) return

  if (formMode.value === 'edit' && editingRevisionId.value) {
    const comparable = buildComparablePayload()
    const changedFields = {}

    for (const key of Object.keys(comparable)) {
      if (comparable[key] !== originalSnapshot.value?.[key]) {
        changedFields[key] = comparable[key]
      }
    }

    const statusPayload = {}
    if (formData.status !== originalStatusSnapshot.value?.status) {
      statusPayload.status = formData.status
    }
    if (formData.status_pagamento !== originalStatusSnapshot.value?.status_pagamento) {
      statusPayload.status_pagamento = formData.status_pagamento
    }

    const hasRegularChanges = Object.keys(changedFields).length > 0
    const hasStatusChanges = Object.keys(statusPayload).length > 0

    if (!hasRegularChanges && !hasStatusChanges) {
      toast.info('Nenhuma alteração foi feita.')
      return
    }

    isSubmitting.value = true
    try {
      let mergedUpdate = {}

      if (hasRegularChanges) {
        const payload = { vehicle_id: vehicle.id, ...comparable }
        const rawUpdated = await revisionService.update(editingRevisionId.value, payload)
        mergedUpdate = { ...mergedUpdate, ...(rawUpdated?.data ?? rawUpdated) }
      }

      if (hasStatusChanges) {
        const rawStatusUpdated = await revisionService.updateStatusFields(
          editingRevisionId.value,
          statusPayload
        )
        mergedUpdate = { ...mergedUpdate, ...(rawStatusUpdated?.data ?? rawStatusUpdated) }
      }

      const currentList = revisionsByVehicle[vehicle.id] || []
      const idx = currentList.findIndex((r) => r.id === editingRevisionId.value)
      if (idx !== -1) {
        currentList.splice(idx, 1, { ...currentList[idx], ...mergedUpdate })
      }
      revisionsByVehicle[vehicle.id] = sortRevisions(currentList)
      toast.success('Revisão atualizada com sucesso!')
      closeForm()
    } catch (err) {
      console.error('Erro ao salvar revisão:', err.response?.data ?? err)
      const validationErrors = err.response?.data?.errors
      formError.value = validationErrors
        ? translateValidationErrors(validationErrors)
        : err.response?.data?.message || err.message || 'Não foi possível salvar a revisão. Tente novamente.'
    } finally {
      isSubmitting.value = false
    }
    return
  }

  isSubmitting.value = true
  try {
    const payload = {
      vehicle_id: vehicle.id,
      description: formData.description.trim(),
      revision_date: formData.revision_date,
      km: formData.km || null,
      cost: formData.cost ?? 0,
      next_revision_date: formData.next_revision_date || null,
      next_revision_km: formData.next_revision_km || null,
      status: formData.status,
      status_pagamento: formData.status_pagamento,
    }

    const rawCreated = await revisionService.create(payload)
    const createdRaw = rawCreated?.data ?? rawCreated
    const created = {
      ...createdRaw,
      status: createdRaw?.status ?? formData.status,
      status_pagamento: createdRaw?.status_pagamento ?? formData.status_pagamento,
    }
    const currentList = revisionsByVehicle[vehicle.id] || []
    revisionsByVehicle[vehicle.id] = sortRevisions([created, ...currentList])
    toast.success('Revisão cadastrada com sucesso!')
    closeForm()
  } catch (err) {
    console.error('Erro ao salvar revisão:', err.response?.data ?? err)
    const validationErrors = err.response?.data?.errors
    formError.value = validationErrors
      ? translateValidationErrors(validationErrors)
      : err.response?.data?.message || err.message || 'Não foi possível salvar a revisão. Tente novamente.'
  } finally {
    isSubmitting.value = false
  }
}

const askDelete = (vehicleId, revision) => {
  revisionToDelete.value = { vehicleId, revision }
}

const closeDeleteConfirm = () => {
  if (deletingRevisionId.value) return
  revisionToDelete.value = null
}

const confirmDelete = async () => {
  if (!revisionToDelete.value) return
  const { vehicleId, revision } = revisionToDelete.value
  deletingRevisionId.value = revision.id
  deleteErrorByVehicle[vehicleId] = ''
  try {
    await revisionService.delete(revision.id)
    revisionsByVehicle[vehicleId] = (revisionsByVehicle[vehicleId] || []).filter(
      (r) => r.id !== revision.id
    )
    if (editingRevisionId.value === revision.id) {
      closeForm()
    }
    toast.success('Revisão removida com sucesso!')
    revisionToDelete.value = null

    // 🔴 AQUI — se essa era a última revisão da pessoa (em todos os veículos),
    // reabre o formulário de criação sozinho, igual ao comportamento inicial
    if (totalRevisionsCount.value === 0) {
      openCreateFormIfEmpty()
    }
  } catch (err) {
    console.error('Erro ao excluir revisão:', err.response?.data ?? err)
    deleteErrorByVehicle[vehicleId] =
      err.response?.data?.message || 'Não foi possível excluir a revisão. Tente novamente.'
    revisionToDelete.value = null
  } finally {
    deletingRevisionId.value = null
  }
}

const goToVehicleRegistration = () => {
  emit('register-vehicle')
}

onMounted(async () => {
  await loadAll()
  openHighlightedForEdit()
  openCreateFormIfEmpty()
})
</script>

<template>
  <BaseModal :title="`Revisões de ${person.name}`" size="xl" @close="emit('close')">
    <div v-if="isLoading" class="py-12 text-center text-sm text-ink-500">
      Carregando revisões...
    </div>

    <div
      v-else-if="!vehicles.length"
      class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-surface-border py-12 text-center"
    >
      <Car :size="24" class="text-ink-300" />
      <p class="text-sm text-ink-500">Essa pessoa ainda não tem veículos cadastrados.</p>
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-700"
        @click="goToVehicleRegistration"
      >
        <Plus :size="14" />
        Cadastrar veículo
      </button>
    </div>

    <div v-else class="flex max-h-[75vh] flex-col gap-6 overflow-y-auto pr-1 sm:max-h-[70vh]">
      <div v-for="vehicle in vehicles" :key="vehicle.id">
        <div class="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex min-w-0 items-center gap-2">
            <Car :size="16" class="shrink-0 text-ink-500" />
            <h3 class="truncate text-sm font-semibold text-ink-900">
              {{ vehicle.model }} · {{ vehicle.license_plate }}
            </h3>
          </div>
          <button
            type="button"
            class="flex shrink-0 items-center gap-1 self-start rounded-lg px-2 py-1 text-xs font-medium transition-colors sm:self-auto"
            :class="openFormVehicleId === vehicle.id && formMode === 'create'
              ? 'text-red-600 hover:bg-red-50 hover:text-red-700'
              : 'text-orange-600 hover:bg-orange-50 hover:text-orange-600'"
            @click="toggleForm(vehicle.id)"
          >
            <component
              :is="openFormVehicleId === vehicle.id && formMode === 'create' ? X : Plus"
              :size="14"
            />
            {{ openFormVehicleId === vehicle.id && formMode === 'create' ? 'Cancelar' : 'Nova revisão' }}
          </button>
        </div>

        <p v-if="deleteErrorByVehicle[vehicle.id]" class="mb-2 flex items-center gap-1 text-xs text-red-600" role="alert">
          <AlertCircle :size="13" class="shrink-0" />
          {{ deleteErrorByVehicle[vehicle.id] }}
        </p>

        <div
          :class="openFormVehicleId === vehicle.id
            ? 'rounded-2xl border-2 border-ink-900 bg-white p-3 shadow-sm sm:p-4'
            : ''"
        >
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
              :ref="setFormRef(vehicle.id)"
              class="mb-3 border-b border-ink-100 pb-3 bg-amber-50/50"
              @submit.prevent="submitRevision(vehicle)"
            >
              <div class="mb-3 flex items-start justify-between gap-2">
                <div class="flex min-w-0 flex-col gap-1">
                  <p class="flex items-center gap-1.5 text-xs font-semibold text-ink-900">
                    <component :is="formMode === 'edit' ? Pencil : Plus" :size="13" />
                    {{ formMode === 'edit' ? 'Editando revisão' : 'Nova revisão' }}
                  </p>
                  <p
                    v-if="formMode === 'edit' && editingRevisionLabel"
                    class="w-fit truncate rounded-md bg-ink-100 px-2 py-1 text-[11px] font-medium text-orange-600"
                  >
                    {{ editingRevisionLabel }}
                  </p>
                </div>
                <p class="shrink-0 text-[11px] text-ink-400">
                  <span class="text-red-500">*</span> obrigatório
                </p>
              </div>

              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                <div class="sm:col-span-2 md:col-span-4">
                  <div class="mb-1 flex items-center justify-between">
                    <label class="text-xs font-medium text-ink-600">
                      Descrição <span class="text-red-500">*</span>
                    </label>
                    <span class="text-[10px] text-ink-300">
                      {{ formData.description.length }}/{{ DESCRIPTION_MAX_LENGTH }}
                    </span>
                  </div>
                  <input
                    :ref="setDescriptionInputRef(vehicle.id)"
                    v-model="formData.description"
                    type="text"
                    maxlength="150"
                    placeholder="Ex: Troca de óleo e filtros"
                    class="w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-1 sm:py-2"
                    :class="fieldErrors.description
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-400'
                      : 'border-ink-200 focus:border-brand-500 focus:ring-brand-500'"
                    @input="fieldErrors.description = ''"
                  />
                  <p v-if="fieldErrors.description" class="mt-1 text-[11px] text-red-600" role="alert">
                    {{ fieldErrors.description }}
                  </p>
                </div>

                <div>
                  <label class="mb-1 block text-xs font-medium text-ink-600">
                    Data da revisão atual <span class="text-red-500">*</span>
                  </label>
                  <input
                    v-model="formData.revision_date"
                    type="date"
                    class="w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-1 sm:py-2"
                    :class="fieldErrors.revision_date
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-400'
                      : 'border-ink-200 focus:border-brand-500 focus:ring-brand-500'"
                    @input="fieldErrors.revision_date = ''"
                  />
                  <p v-if="fieldErrors.revision_date" class="mt-1 text-[11px] text-red-600" role="alert">
                    {{ fieldErrors.revision_date }}
                  </p>
                </div>

                <div>
                  <label class="mb-1 block text-xs font-medium text-ink-600">KM da revisão atual</label>
                  <input
                    v-model="kmModel"
                    type="text"
                    inputmode="numeric"
                    placeholder="Ex: 0 km"
                    class="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:py-2"
                    @keydown="blockKmOverflow"
                    @paste="blockKmPaste"
                  />
                </div>

                <div>
                  <label class="mb-1 block text-xs font-medium text-ink-600">
                    Custo (R$) <span class="text-red-500">*</span>
                  </label>
                  <input
                    v-model="costModel"
                    type="text"
                    inputmode="decimal"
                    placeholder="0,00"
                    class="w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-1 sm:py-2"
                    :class="fieldErrors.cost
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-400'
                      : 'border-ink-200 focus:border-brand-500 focus:ring-brand-500'"
                    @keydown="blockCostOverflow"
                    @paste="blockCostPaste"
                  />
                  <p v-if="fieldErrors.cost" class="mt-1 text-[11px] text-red-600" role="alert">
                    {{ fieldErrors.cost }}
                  </p>
                  <p v-else class="mt-1 text-[11px] text-ink-400">
                    Serviço gratuito? Informe 0,00.
                  </p>
                </div>

                <div>
                  <label class="mb-1 block text-xs font-medium text-ink-600">Data da próxima revisão</label>
                  <input
                    v-model="formData.next_revision_date"
                    type="date"
                    :min="minNextRevisionDate"
                    :max="maxNextRevisionDate"
                    class="w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-1 sm:py-2"
                    :class="fieldErrors.next_revision_date
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-400'
                      : 'border-ink-200 focus:border-brand-500 focus:ring-brand-500'"
                    @input="fieldErrors.next_revision_date = ''"
                  />
                  <p v-if="fieldErrors.next_revision_date" class="mt-1 text-[11px] text-red-600" role="alert">
                    {{ fieldErrors.next_revision_date }}
                  </p>
                  <p v-else class="mt-1 text-[11px] text-ink-400">
                    Até {{ MAX_YEARS_AHEAD }} anos a partir de hoje.
                  </p>
                </div>

                <div>
                  <label class="mb-1 block text-xs font-medium text-ink-600">KM da próxima revisão</label>
                  <input
                    v-model="nextRevisionKmModel"
                    type="text"
                    inputmode="numeric"
                    placeholder="Ex: 0 km"
                    class="w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-1 sm:py-2"
                    :class="fieldErrors.next_revision_km
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-400'
                      : 'border-ink-200 focus:border-brand-500 focus:ring-brand-500'"
                    @keydown="blockKmOverflow"
                    @paste="blockNextRevisionKmPaste"
                  />
                  <p v-if="fieldErrors.next_revision_km" class="mt-1 text-[11px] text-red-600" role="alert">
                    {{ fieldErrors.next_revision_km }}
                  </p>
                </div>

                <div>
                  <label class="mb-1 block text-xs font-medium text-ink-600">Status</label>
                  <select
                    v-model="formData.status"
                    class="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:py-2"
                  >
                    <option v-for="opt in statusOptionsForForm" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </select>
                </div>

                <div>
                  <label class="mb-1 block text-xs font-medium text-ink-600">Status de pagamento</label>
                  <select
                    v-model="formData.status_pagamento"
                    class="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:py-2"
                  >
                    <option v-for="opt in STATUS_PAGAMENTO_OPTIONS" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </select>
                </div>
              </div>

              <div class="mt-3 flex flex-col gap-3 border-t border-ink-100 pt-3 sm:flex-row sm:items-center sm:justify-end">
                <p v-if="formError" class="flex items-start gap-1 text-xs text-red-600 sm:mr-auto sm:items-center" role="alert">
                  <AlertCircle :size="13" class="mt-0.5 shrink-0 sm:mt-0" />
                  {{ formError }}
                </p>
                <div class="flex gap-3 sm:contents">
                  <button
                    type="button"
                    class="flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:flex-none sm:py-1.5 text-red-600 hover:bg-red-50 hover:text-red-700"
                    @click="closeForm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    :disabled="isSubmitting || !hasChanges"
                    class="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none sm:py-1.5"
                    :class="formMode === 'edit' ? 'bg-ink-900 hover:bg-ink-800' : 'bg-brand-600 hover:bg-brand-700'"
                  >
                    <Loader2 v-if="isSubmitting" :size="13" class="animate-spin" />
                    {{ isSubmitting ? 'Salvando...' : formMode === 'edit' ? 'Salvar alterações' : 'Salvar revisão' }}
                  </button>
                </div>
              </div>
            </form>
          </Transition>

          <div
            v-if="!visibleRevisions(vehicle.id).length"
            class="rounded-xl border border-ink-100 px-3 py-4 text-center text-xs text-ink-400"
          >
            {{
              formMode === 'edit' && openFormVehicleId === vehicle.id && revisionsByVehicle[vehicle.id]?.length
                ? 'A revisão em edição está referenciada acima.'
                : 'Nenhuma revisão registrada.'
            }}
          </div>

          <template v-else>
            <div class="flex flex-col gap-2 sm:hidden">
              <div
                v-for="revision in visibleRevisions(vehicle.id)"
                :key="revision.id"
                class="rounded-xl border border-ink-100 p-3 text-xs"
                :class="editingRevisionId === revision.id ? 'bg-ink-50' : 'bg-white'"
              >
                <div class="mb-2 flex items-start justify-between gap-2">
                  <div class="flex min-w-0 items-center gap-1.5 text-ink-700">
                    <Wrench :size="12" class="shrink-0 text-ink-400" />
                    <span class="truncate font-medium">{{ revision.description || '—' }}</span>
                  </div>

                  <div class="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      title="Editar revisão"
                      class="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
                      @click="startEdit(vehicle.id, revision)"
                    >
                      <Pencil :size="14" />
                    </button>
                    <button
                      type="button"
                      title="Excluir revisão"
                      class="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      @click="askDelete(vehicle.id, revision)"
                    >
                      <Trash2 :size="14" />
                    </button>
                  </div>
                </div>

                <div class="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <div class="flex items-center gap-1">
                    <span class="text-ink-400">Status:</span>
                    <span
                      class="rounded-full border px-2 py-0.5 text-[10px] font-medium"
                      :class="STATUS_BADGE_CLASSES[revision.status] || 'border-ink-200 text-ink-500'"
                    >
                      {{ statusLabel(revision.status) }}
                    </span>
                  </div>
                  <div class="flex items-center gap-1">
                    <span class="text-ink-400">Pagamento:</span>
                    <span
                      class="rounded-full border px-2 py-0.5 text-[10px] font-medium"
                      :class="STATUS_PAGAMENTO_BADGE_CLASSES[revision.status_pagamento] || 'border-ink-200 text-ink-500'"
                    >
                      {{ statusPagamentoLabel(revision.status_pagamento) }}
                    </span>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-ink-600">
                  <div>
                    <span class="text-ink-400">Data:</span>
                    {{ formatDate(revision.revision_date) }}
                  </div>
                  <div>
                    <span class="text-ink-400">KM:</span>
                    {{ revision.km ? Number(revision.km).toLocaleString('pt-BR') : '—' }}
                  </div>
                  <div>
                    <span class="text-ink-400">Custo:</span>
                    {{ formatCurrency(revision.cost) }}
                  </div>
                  <div :class="isOverdue(revision.next_revision_date) ? 'font-medium text-red-600' : ''">
                    <span class="text-ink-400" :class="isOverdue(revision.next_revision_date) ? 'text-red-400' : ''">Próxima:</span>
                    {{ formatDate(revision.next_revision_date) }}
                    <span v-if="revision.next_revision_km" class="block text-[11px] text-ink-400">
                      {{ Number(revision.next_revision_km).toLocaleString('pt-BR') }} km
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div class="hidden overflow-x-auto rounded-xl border border-ink-100 sm:block">
              <table class="w-full min-w-[640px] text-left text-xs">
                <thead class="bg-ink-50 text-ink-500">
                  <tr>
                    <th class="px-3 py-2 font-medium">Descrição</th>
                    <th class="px-3 py-2 font-medium">Data</th>
                    <th class="px-3 py-2 font-medium">KM</th>
                    <th class="px-3 py-2 font-medium">Custo</th>
                    <th class="px-3 py-2 font-medium">Status</th>
                    <th class="px-3 py-2 font-medium">Pagamento</th>
                    <th class="px-3 py-2 font-medium">Próxima revisão</th>
                    <th class="px-3 py-2 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-ink-100">
                  <tr
                    v-for="revision in visibleRevisions(vehicle.id)"
                    :key="revision.id"
                    class="text-ink-700"
                    :class="editingRevisionId === revision.id ? 'bg-ink-50' : ''"
                  >
                    <td class="px-3 py-2">
                      <div class="flex items-center gap-1.5">
                        <Wrench :size="12" class="text-ink-400" />
                        {{ revision.description || '—' }}
                      </div>
                    </td>
                    <td class="px-3 py-2">{{ formatDate(revision.revision_date) }}</td>
                    <td class="px-3 py-2">{{ revision.km ? Number(revision.km).toLocaleString('pt-BR') : '—' }}</td>
                    <td class="px-3 py-2">{{ formatCurrency(revision.cost) }}</td>
                    <td class="px-3 py-2">
                      <span
                        class="w-fit rounded-full border px-2 py-0.5 text-[10px] font-medium"
                        :class="STATUS_BADGE_CLASSES[revision.status] || 'border-ink-200 text-ink-500'"
                      >
                        {{ statusLabel(revision.status) }}
                      </span>
                    </td>
                    <td class="px-3 py-2">
                      <span
                        class="w-fit rounded-full border px-2 py-0.5 text-[10px] font-medium"
                        :class="STATUS_PAGAMENTO_BADGE_CLASSES[revision.status_pagamento] || 'border-ink-200 text-ink-500'"
                      >
                        {{ statusPagamentoLabel(revision.status_pagamento) }}
                      </span>
                    </td>
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
                          @click="askDelete(vehicle.id, revision)"
                        >
                          <Trash2 :size="14" />
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>
      </div>
    </div>

    <ConfirmModal
      v-if="revisionToDelete"
      title="Remover revisão"
      :message="`Tem certeza que deseja remover a revisão &quot;${revisionToDelete.revision.description || 'sem descrição'}&quot;? Essa ação não pode ser desfeita.`"
      confirm-label="Remover"
      :is-loading="deletingRevisionId === revisionToDelete.revision.id"
      @close="closeDeleteConfirm"
      @confirm="confirmDelete"
    />
  </BaseModal>
</template>