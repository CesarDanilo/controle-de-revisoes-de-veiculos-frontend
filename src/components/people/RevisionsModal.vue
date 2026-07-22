<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Car, Wrench, Plus, X, Loader2, AlertCircle, Pencil, Trash2, Check } from '@lucide/vue'
import BaseModal from '../ui/BaseModal.vue'
import { vehicleService } from '../../services/vehicle.service'
import { revisionService } from '../../services/revision.service'
import { useToast } from '../../composables/useToast'

const props = defineProps({
  person: { type: Object, required: true },
})

const emit = defineEmits(['close'])

const toast = useToast()

const vehicles = ref([])
const revisionsByVehicle = reactive({})
const isLoading = ref(true)

// --- Revision form state (shared between create and edit) ---
const openFormVehicleId = ref(null)
const formMode = ref('create') // 'create' | 'edit'
const editingRevisionId = ref(null)
const isSubmitting = ref(false)
const formError = ref('') // erros gerais/backend, não ligados a um campo específico

const DESCRIPTION_MAX_LENGTH = 150

const emptyFieldErrors = () => ({
  description: '',
  revision_date: '',
  cost: '',
  next_revision_date: '',
  next_revision_km: '',
})
const fieldErrors = reactive(emptyFieldErrors())

// custo nasce em 0 (não null) — pagamento é sempre informado, mesmo que gratuito
const emptyForm = () => ({
  description: '',
  revision_date: new Date().toISOString().slice(0, 10),
  km: null,
  cost: 0,
  next_revision_date: '',
  next_revision_km: null,
})
const formData = reactive(emptyForm())

// snapshot normalizado da revisão original (usado pra detectar o que mudou na edição)
const originalSnapshot = ref(null)

// --- Delete state ---
const confirmingDeleteId = ref(null)
const deletingRevisionId = ref(null)
const deleteErrorByVehicle = reactive({})

// ---------- formatação de data (FIX timezone) ----------
// Antes: new Date(dateStr).toLocaleDateString('pt-BR')
// Problema: new Date('2026-07-22') é interpretado como 2026-07-22T00:00:00Z (UTC).
// Ao converter pro horário local (Brasil = UTC-3), meia-noite UTC vira 21h do dia
// ANTERIOR, e o toLocaleDateString mostrava a data errada (um dia a menos).
// Correção: extrai ano/mês/dia direto da string, sem nunca criar um objeto Date.
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

// ---------- isOverdue (FIX timezone) ----------
// Mesmo problema do formatDate: new Date(dateStr) fica em meia-noite UTC, enquanto
// "today" é meia-noite local. Isso podia marcar uma revisão de HOJE como atrasada.
// Correção: compara strings yyyy-mm-dd diretamente, sem criar Date a partir do ISO.
const isOverdue = (dateStr) => {
  if (!dateStr) return false
  const todayISO = new Date().toLocaleDateString('sv-SE') // yyyy-mm-dd no fuso local
  return String(dateStr).slice(0, 10) < todayISO
}

const sortRevisions = (list) =>
  [...list].sort((a, b) => new Date(b.revision_date) - new Date(a.revision_date))

// ---------- limite de dígitos do KM ----------
const MAX_KM_DIGITS = 7 // permite até 9.999.999 km

function blockKmOverflow(e) {
  const controlKeys = [
    'Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight',
    'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter',
  ]
  if (controlKeys.includes(e.key)) return
  if (e.ctrlKey || e.metaKey) return
  if (!/^\d$/.test(e.key)) return // deixa o navegador barrar não-dígito (type=number já ajuda)

  const target = e.target
  const hasSelection = target.selectionStart !== target.selectionEnd
  if (hasSelection) return

  if (target.value.length >= MAX_KM_DIGITS) {
    e.preventDefault()
  }
}

// ---------- máscara de moeda para o custo, com limite ----------
// digita "1590" -> mostra "15,90" (preenche da direita, como caixa eletrônico)
const MAX_COST_DIGITS = 8 // até R$ 999.999,99 — ajuste conforme a realidade do seu negócio

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
      // campo limpo pelo usuário: fica temporariamente vazio até o submit validar
      formData.cost = null
      return
    }
    formData.cost = Number(digits) / 100
  },
})

// ---------- bloqueio de digitação ao atingir o limite do custo ----------
function blockCostOverflow(e) {
  const controlKeys = [
    'Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight',
    'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter',
  ]
  if (controlKeys.includes(e.key)) return
  if (e.ctrlKey || e.metaKey) return

  // campo é só de dígitos (a formatação de vírgula/ponto é automática) — bloqueia letra/símbolo
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

// ---------- bloqueio explícito de paste com símbolos/letras no custo ----------
// intercepta o paste manualmente: extrai só os dígitos do que foi colado e insere
// na posição do cursor, em vez de deixar o navegador colar o texto bruto
function blockCostPaste(e) {
  e.preventDefault()
  const pasted = (e.clipboardData || window.clipboardData).getData('text')
  const digitsOnly = pasted.replace(/\D/g, '')
  if (!digitsOnly) return // nada de numérico foi colado: ignora silenciosamente

  const target = e.target
  const currentDigits = costModel.value.replace(/\D/g, '')
  const start = target.selectionStart
  const end = target.selectionEnd

  // remove a seleção atual (se houver) e insere os dígitos colados na posição do cursor
  const beforeCursorDigits = currentDigits.slice(0, start)
  const afterCursorDigits = currentDigits.slice(end)
  const merged = (beforeCursorDigits + digitsOnly + afterCursorDigits).slice(0, MAX_COST_DIGITS)

  costModel.value = merged
}

// ---------- tradução de erros de validação vindos do Laravel ----------
const FIELD_LABELS = {
  description: 'Descrição',
  revision_date: 'Data da revisão',
  km: 'KM',
  cost: 'Custo',
  next_revision_date: 'Próxima revisão (data)',
  next_revision_km: 'Próxima revisão (KM)',
  vehicle_id: 'Veículo',
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

  // fallback: mantém a mensagem original, mas com o rótulo em português na frente
  return `${label}: ${message}`
}

function translateValidationErrors(validationErrors) {
  return Object.entries(validationErrors)
    .flatMap(([field, messages]) => messages.map((msg) => translateValidationMessage(field, msg)))
    .join(' ')
}

// ---------- comparação de campos alterados (evita update desnecessário) ----------
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
  Object.assign(fieldErrors, emptyFieldErrors())
  originalSnapshot.value = null
  Object.assign(formData, emptyForm())
}

// Open the same form pre-filled, for editing an existing revision.
const startEdit = (vehicleId, revision) => {
  confirmingDeleteId.value = null
  openFormVehicleId.value = vehicleId
  formMode.value = 'edit'
  editingRevisionId.value = revision.id
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
  })

  // captura o snapshot já normalizado, pra comparar "de igual pra igual" no submit
  originalSnapshot.value = buildComparablePayload()
}

const closeForm = () => {
  openFormVehicleId.value = null
  formMode.value = 'create'
  editingRevisionId.value = null
  formError.value = ''
  Object.assign(fieldErrors, emptyFieldErrors())
  originalSnapshot.value = null
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
  // alinhado com a regra "after" (estritamente posterior) do backend:
  // datas iguais também são bloqueadas aqui, evitando ida desnecessária à API.
  // erro fica preso especificamente ao campo "Data da próxima revisão", não a um banner genérico,
  // pra não ser confundido com o campo "Data da revisão atual".
  if (
    formData.next_revision_date &&
    formData.revision_date &&
    new Date(formData.next_revision_date) <= new Date(formData.revision_date)
  ) {
    fieldErrors.next_revision_date =
      'A data da próxima revisão deve ser posterior à data da revisão atual (não pode ser igual).'
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

  // --- modo edição: verifica se algo realmente mudou antes de chamar a API ---
  if (formMode.value === 'edit' && editingRevisionId.value) {
    const comparable = buildComparablePayload()
    const changedFields = {}

    for (const key of Object.keys(comparable)) {
      if (comparable[key] !== originalSnapshot.value?.[key]) {
        changedFields[key] = comparable[key]
      }
    }

    if (Object.keys(changedFields).length === 0) {
      toast.info('Nenhuma alteração foi feita.')
      return
    }

    isSubmitting.value = true
    try {
      // envia o payload COMPLETO (não só os campos alterados). O backend exige alguns
      // campos como obrigatórios em toda atualização (ex.: revision_date), então mandar
      // apenas o que mudou fazia a API rejeitar o request mesmo com o campo preenchido na tela.
      // A checagem "nada mudou" acima já garante que só chegamos aqui se algo mudou de fato,
      // então enviar tudo aqui não gera updates vazios desnecessários.
      const payload = { vehicle_id: vehicle.id, ...comparable }
      const rawUpdated = await revisionService.update(editingRevisionId.value, payload)
      const updated = rawUpdated?.data ?? rawUpdated
      const currentList = revisionsByVehicle[vehicle.id] || []
      const idx = currentList.findIndex((r) => r.id === editingRevisionId.value)
      if (idx !== -1) {
        currentList.splice(idx, 1, { ...currentList[idx], ...updated })
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

  // --- modo criação: comportamento original, envia tudo ---
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
    }

    const rawCreated = await revisionService.create(payload)
    const created = rawCreated?.data ?? rawCreated
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
    toast.success('Revisão removida com sucesso!')
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

    <!-- mobile-first: max-h menor em telas pequenas (menos chrome de teclado/URL bar
         disputando espaço), cresce a partir do sm -->
    <div v-else class="flex max-h-[75vh] flex-col gap-6 overflow-y-auto pr-1 sm:max-h-[70vh]">
      <div v-for="vehicle in vehicles" :key="vehicle.id">
        <!-- Cabeçalho do veículo: empilha em telas muito estreitas, vira linha a partir do sm -->
        <div class="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex min-w-0 items-center gap-2">
            <Car :size="16" class="shrink-0 text-ink-500" />
            <h3 class="truncate text-sm font-semibold text-ink-900">
              {{ vehicle.model }} · {{ vehicle.license_plate }}
            </h3>
          </div>
          <button
            type="button"
            class="flex shrink-0 items-center gap-1 self-start rounded-lg px-2 py-1 text-xs font-medium text-brand-600 transition-colors hover:text-brand-700 sm:self-auto sm:px-0 sm:py-0"
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
            class="mb-3 rounded-xl border p-3 sm:p-4"
            :class="formMode === 'edit' ? 'border-amber-200 bg-amber-50/60' : 'border-brand-200 bg-brand-50/60'"
            @submit.prevent="submitRevision(vehicle)"
          >
            <div class="mb-3 flex items-center justify-between">
              <p class="text-xs font-semibold" :class="formMode === 'edit' ? 'text-amber-700' : 'text-brand-700'">
                {{ formMode === 'edit' ? 'Editando revisão' : 'Nova revisão' }}
              </p>
              <p class="text-[11px] text-ink-400">
                <span class="text-red-500">*</span> obrigatório
              </p>
            </div>

            <!-- mobile-first: 1 coluna por padrão, 2 a partir do sm, 4 a partir do md -->
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
                  v-model="formData.description"
                  type="text"
                  maxlength="150"
                  placeholder="Ex: Troca de óleo e filtros"
                  class="w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-1 sm:py-2"
                  :class="fieldErrors.description
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-400'
                    : 'border-ink-200 focus:border-brand-500 focus:ring-brand-500'"
                  autofocus
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
                  v-model.number="formData.km"
                  type="number"
                  min="0"
                  placeholder="0"
                  class="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:py-2"
                  @keydown="blockKmOverflow"
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
                  class="w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-1 sm:py-2"
                  :class="fieldErrors.next_revision_date
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-400'
                    : 'border-ink-200 focus:border-brand-500 focus:ring-brand-500'"
                  @input="fieldErrors.next_revision_date = ''"
                />
                <p v-if="fieldErrors.next_revision_date" class="mt-1 text-[11px] text-red-600" role="alert">
                  {{ fieldErrors.next_revision_date }}
                </p>
              </div>

              <div>
                <label class="mb-1 block text-xs font-medium text-ink-600">KM da próxima revisão</label>
                <input
                  v-model.number="formData.next_revision_km"
                  type="number"
                  min="0"
                  placeholder="0"
                  class="w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-1 sm:py-2"
                  :class="fieldErrors.next_revision_km
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-400'
                    : 'border-ink-200 focus:border-brand-500 focus:ring-brand-500'"
                  @keydown="blockKmOverflow"
                  @input="fieldErrors.next_revision_km = ''"
                />
                <p v-if="fieldErrors.next_revision_km" class="mt-1 text-[11px] text-red-600" role="alert">
                  {{ fieldErrors.next_revision_km }}
                </p>
              </div>
            </div>

            <!-- Ações do formulário: empilha e ocupa a largura toda no mobile,
                 vira linha alinhada à direita a partir do sm -->
            <div
              class="mt-3 flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-end"
              :class="formMode === 'edit' ? 'border-amber-100' : 'border-brand-100'"
            >
              <p v-if="formError" class="flex items-start gap-1 text-xs text-red-600 sm:mr-auto sm:items-center" role="alert">
                <AlertCircle :size="13" class="mt-0.5 shrink-0 sm:mt-0" />
                {{ formError }}
              </p>
              <div class="flex gap-3 sm:contents">
                <button
                  type="button"
                  class="flex-1 rounded-lg px-3 py-2 text-xs font-medium text-ink-500 transition-colors hover:bg-ink-100 sm:flex-none sm:py-1.5"
                  @click="closeForm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  :disabled="isSubmitting"
                  class="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none sm:py-1.5"
                  :class="formMode === 'edit' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-brand-600 hover:bg-brand-700'"
                >
                  <Loader2 v-if="isSubmitting" :size="13" class="animate-spin" />
                  {{ isSubmitting ? 'Salvando...' : formMode === 'edit' ? 'Salvar alterações' : 'Salvar revisão' }}
                </button>
              </div>
            </div>
          </form>
        </Transition>

        <!-- Sem revisões: mesma mensagem em ambos os layouts -->
        <div
          v-if="!revisionsByVehicle[vehicle.id]?.length"
          class="rounded-xl border border-ink-100 px-3 py-4 text-center text-xs text-ink-400"
        >
          Nenhuma revisão registrada.
        </div>

        <template v-else>
          <!-- ===== MOBILE (< sm): lista de cards em vez de tabela ===== -->
          <div class="flex flex-col gap-2 sm:hidden">
            <div
              v-for="revision in revisionsByVehicle[vehicle.id]"
              :key="revision.id"
              class="rounded-xl border border-ink-100 p-3 text-xs"
              :class="editingRevisionId === revision.id ? 'bg-amber-50/50' : 'bg-white'"
            >
              <div class="mb-2 flex items-start justify-between gap-2">
                <div class="flex min-w-0 items-center gap-1.5 text-ink-700">
                  <Wrench :size="12" class="shrink-0 text-ink-400" />
                  <span class="truncate font-medium">{{ revision.description || '—' }}</span>
                </div>

                <div class="flex shrink-0 items-center gap-1">
                  <template v-if="confirmingDeleteId === revision.id">
                    <span class="mr-0.5 text-[11px] text-ink-500">Excluir?</span>
                    <button
                      type="button"
                      title="Confirmar exclusão"
                      :disabled="deletingRevisionId === revision.id"
                      class="rounded-md p-1.5 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                      @click="confirmDelete(vehicle.id, revision.id)"
                    >
                      <Loader2 v-if="deletingRevisionId === revision.id" :size="14" class="animate-spin" />
                      <Check v-else :size="14" />
                    </button>
                    <button
                      type="button"
                      title="Cancelar"
                      :disabled="deletingRevisionId === revision.id"
                      class="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-100 disabled:opacity-50"
                      @click="cancelDelete"
                    >
                      <X :size="14" />
                    </button>
                  </template>
                  <template v-else>
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
                      @click="askDelete(revision.id)"
                    >
                      <Trash2 :size="14" />
                    </button>
                  </template>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-ink-600">
                <div>
                  <span class="text-ink-400">Data:</span>
                  {{ formatDate(revision.revision_date) }}
                </div>
                <div>
                  <span class="text-ink-400">KM:</span>
                  {{ revision.km ?? '—' }}
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

          <!-- ===== DESKTOP (>= sm): tabela original ===== -->
          <div class="hidden overflow-x-auto rounded-xl border border-ink-100 sm:block">
            <table class="w-full min-w-[560px] text-left text-xs">
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
        </template>
      </div>
    </div>
  </BaseModal>
</template>