<script setup>
import { reactive, ref, computed, watch } from 'vue'
import { User, Mail, Phone, IdCard, Loader2, CheckCircle2, Building2 } from '@lucide/vue'
import BaseModal from '../ui/BaseModal.vue'
import BaseInput from '../ui/BaseInput.vue'
import BaseButton from '../ui/BaseButton.vue'
import { personSchema } from '../../schemas/person.schema'
import { maskPhone } from '../../utils/masks'
import { useToast } from '../../composables/useToast'
import { useEmailValidation } from '../../composables/useEmailValidation'

const props = defineProps({
  person: { type: Object, default: null },
})

const emit = defineEmits(['close', 'submit'])

const toast = useToast()

const isEditing = !!props.person

const NAME_MAX_LENGTH = 100
const EMAIL_MAX_LENGTH = 100

// 🔴 AQUI — tipo de pessoa, controlado manualmente pelo usuário
// no modo edição, detecta o tipo inicial pelo tamanho do documento salvo
const personType = ref(
  props.person?.document && props.person.document.replace(/\D/g, '').length === 14
    ? 'PJ'
    : 'PF'
)

const form = reactive({
  name: props.person?.name ?? '',
  email: props.person?.email ?? '',
  phone: props.person?.phone ?? '',       // guarda só dígitos
  document: props.person?.document ?? '', // guarda só dígitos (CPF ou CNPJ)
  gender: props.person?.gender ?? 'O',
})

// ---------- snapshot original (só relevante no modo edição) ----------
const originalSnapshot = isEditing
  ? {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone,
      document: form.document,
      gender: form.gender,
    }
  : null

function buildComparablePayload() {
  return {
    name: form.name.trim(),
    email: form.email.trim(),
    phone: form.phone,
    document: form.document,
    gender: form.gender,
  }
}

function hasChanges() {
  if (!originalSnapshot) return true

  const current = buildComparablePayload()
  return Object.keys(current).some((key) => current[key] !== originalSnapshot[key])
}

// ---------- computeds ligados ao v-model dos inputs ----------
const phoneModel = computed({
  get: () => maskPhone(form.phone),
  set: (val) => {
    form.phone = val.replace(/\D/g, '').slice(0, 11)
  },
})

// 🔴 AQUI — troca de tipo limpa o documento, evita ficar com dígitos
// de um tipo aplicados na máscara do outro
function selectPersonType(type) {
  if (personType.value === type) return
  personType.value = type
  form.document = ''
  fieldErrors.value.document = undefined
}

const DOCUMENT_MAX_LENGTH = computed(() => (personType.value === 'PJ' ? 14 : 11))

function maskCpfLocal(digits) {
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

function maskCnpj(digits) {
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

const documentModel = computed({
  get: () => {
    const digits = form.document
    return personType.value === 'PJ' ? maskCnpj(digits) : maskCpfLocal(digits)
  },
  set: (val) => {
    form.document = val.replace(/\D/g, '').slice(0, DOCUMENT_MAX_LENGTH.value)
  },
})

const documentLabel = computed(() => (personType.value === 'PJ' ? 'CNPJ' : 'CPF'))
const documentPlaceholder = computed(() =>
  personType.value === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'
)

const fieldErrors = ref({})
const isSubmitting = ref(false)

// ---------- validação de email via Abstract API ----------
const { isChecking, isValid, errorMessage, checkEmail, checkEmailDebounced } = useEmailValidation()

watch(
  () => form.email,
  (newEmail) => {
    if (isEditing && newEmail.trim() === originalSnapshot.email) {
      isValid.value = null
      return
    }

    const trimmed = newEmail.trim()
    if (trimmed.length > 5) {
      checkEmailDebounced(trimmed)
    } else {
      isValid.value = null
    }
  }
)

const handleSubmit = async () => {
  const result = personSchema.safeParse(form)

  if (!result.success) {
    fieldErrors.value = result.error.flatten().fieldErrors
    return
  }

  // 🔴 AQUI — garante consistência entre o tipo selecionado e o tamanho do documento
  // (evita, por exemplo, usuário selecionar PF mas colar um CNPJ completo)
  const documentDigits = form.document.replace(/\D/g, '')
  const expectedLength = personType.value === 'PJ' ? 14 : 11
  if (documentDigits.length !== expectedLength) {
    fieldErrors.value = {
      ...fieldErrors.value,
      document: [
        personType.value === 'PJ'
          ? 'Informe um CNPJ completo (14 dígitos).'
          : 'Informe um CPF completo (11 dígitos).',
      ],
    }
    return
  }

  fieldErrors.value = {}

  if (isEditing && !hasChanges()) {
    toast.info('Nenhuma alteração foi feita.')
    return
  }

  const emailUnchanged = isEditing && form.email.trim() === originalSnapshot.email

  if (!emailUnchanged) {
    await checkEmail(form.email.trim())

    if (isValid.value === false) {
      toast.error(errorMessage.value || 'Corrija o e-mail antes de continuar.')
      return
    }
  }

  isSubmitting.value = true
  try {
    await emit('submit', result.data)
  } finally {
    isSubmitting.value = false
  }
}

function createLengthGuard(getValue, maxLength) {
  return function (e) {
    const controlKeys = [
      'Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight',
      'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter',
    ]
    if (controlKeys.includes(e.key)) return
    if (e.ctrlKey || e.metaKey) return
    if (e.key.length > 1) return

    const target = e.target
    const hasSelection = target.selectionStart !== target.selectionEnd
    if (hasSelection) return

    if (getValue().length >= maxLength) {
      e.preventDefault()
    }
  }
}

function blockDocumentOverflow(e) {
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

  if (form.document.length >= DOCUMENT_MAX_LENGTH.value) {
    e.preventDefault()
  }
}

const sanitizeNameLength = () => {
  if (form.name.length > NAME_MAX_LENGTH) {
    form.name = form.name.slice(0, NAME_MAX_LENGTH)
  }
}

const sanitizeEmailLength = () => {
  if (form.email.length > EMAIL_MAX_LENGTH) {
    form.email = form.email.slice(0, EMAIL_MAX_LENGTH)
  }
}

const blockNameOverflow = createLengthGuard(() => form.name, NAME_MAX_LENGTH)
const blockEmailOverflow = createLengthGuard(() => form.email, EMAIL_MAX_LENGTH)

function createNumericGuard(getRawValue, maxLength) {
  return function (e) {
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

    if (getRawValue().length >= maxLength) {
      e.preventDefault()
    }
  }
}

const blockPhoneOverflow = createNumericGuard(() => form.phone, 11)

const nameCharCount = computed(() => form.name.length)
const emailCharCount = computed(() => form.email.length)
</script>

<template>
  <BaseModal :title="isEditing ? 'Editar pessoa' : 'Nova pessoa'" @close="emit('close')">
    <form class="flex flex-col gap-4" @submit.prevent="handleSubmit" novalidate>
      <!-- 🔴 AQUI — seletor manual de tipo de pessoa -->
      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium text-ink-700">Tipo de cadastro</label>
        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            class="flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors"
            :class="personType === 'PF'
              ? 'border-brand-500 bg-brand-50 text-brand-700'
              : 'border-surface-border bg-white text-ink-500 hover:bg-ink-50'"
            @click="selectPersonType('PF')"
          >
            <User :size="16" />
            Pessoa Física
          </button>
          <button
            type="button"
            class="flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors"
            :class="personType === 'PJ'
              ? 'border-brand-500 bg-brand-50 text-brand-700'
              : 'border-surface-border bg-white text-ink-500 hover:bg-ink-50'"
            @click="selectPersonType('PJ')"
          >
            <Building2 :size="16" />
            Pessoa Jurídica
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <BaseInput
          v-model="form.name"
          :label="personType === 'PJ' ? 'Razão social' : 'Nome'"
          :icon="User"
          :placeholder="personType === 'PJ' ? 'Nome da empresa' : 'Nome completo'"
          :maxlength="NAME_MAX_LENGTH"
          @keydown="blockNameOverflow"
          @input="sanitizeNameLength"
        />
        <div class="flex items-center justify-between">
          <span v-if="fieldErrors.name" class="text-xs text-red-600">{{ fieldErrors.name[0] }}</span>
          <span v-else></span>
          <span
            class="text-xs"
            :class="nameCharCount >= NAME_MAX_LENGTH ? 'text-red-500' : 'text-ink-400'"
          >
            {{ nameCharCount }}/{{ NAME_MAX_LENGTH }}
          </span>
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <div class="relative">
          <BaseInput
            v-model="form.email"
            label="E-mail"
            type="email"
            :icon="Mail"
            placeholder="pessoa@exemplo.com"
            :maxlength="EMAIL_MAX_LENGTH"
            @keydown="blockEmailOverflow"
            @input="sanitizeEmailLength"
          />
          <Loader2
            v-if="isChecking"
            :size="16"
            class="absolute right-3 top-9 animate-spin text-ink-300"
          />
          <CheckCircle2
            v-else-if="isValid === true"
            :size="16"
            class="absolute right-3 top-9 text-green-500"
          />
        </div>
        <div class="flex items-center justify-between">
          <span v-if="fieldErrors.email" class="text-xs text-red-600">{{ fieldErrors.email[0] }}</span>
          <span v-else-if="isValid === false" class="text-xs text-red-600">{{ errorMessage }}</span>
          <span v-else-if="isValid === true" class="text-xs text-green-600">E-mail válido</span>
          <span v-else></span>
          <span
            class="text-xs"
            :class="emailCharCount >= EMAIL_MAX_LENGTH ? 'text-red-500' : 'text-ink-400'"
          >
            {{ emailCharCount }}/{{ EMAIL_MAX_LENGTH }}
          </span>
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <BaseInput
          v-model="phoneModel"
          label="Telefone"
          :icon="Phone"
          placeholder="(00) 00000-0000"
          inputmode="numeric"
          maxlength="15"
          @keydown="blockPhoneOverflow"
        />
        <span v-if="fieldErrors.phone" class="text-xs text-red-600">{{ fieldErrors.phone[0] }}</span>
      </div>

      <div class="flex flex-col gap-1.5">
        <BaseInput
          v-model="documentModel"
          :label="documentLabel"
          :icon="IdCard"
          :placeholder="documentPlaceholder"
          inputmode="numeric"
          :maxlength="personType === 'PJ' ? 18 : 14"
          @keydown="blockDocumentOverflow"
        />
        <span v-if="fieldErrors.document" class="text-xs text-red-600">{{ fieldErrors.document[0] }}</span>
      </div>

      <div class="mt-2 flex justify-end gap-3">
        <BaseButton type="button" variant="ghost" @click="emit('close')">
          Cancelar
        </BaseButton>
        <BaseButton type="submit" :disabled="isSubmitting || isChecking">
          {{ isSubmitting ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Cadastrar' }}
        </BaseButton>
      </div>
    </form>
  </BaseModal>
</template>