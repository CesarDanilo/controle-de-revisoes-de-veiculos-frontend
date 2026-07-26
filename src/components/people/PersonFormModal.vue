<script setup>
import { reactive, ref, computed } from 'vue'
import { User, Mail, Phone, IdCard, Building2, Calendar } from '@lucide/vue'
import BaseModal from '../ui/BaseModal.vue'
import BaseInput from '../ui/BaseInput.vue'
import BaseButton from '../ui/BaseButton.vue'
import { personSchema } from '../../schemas/person.schema'
import { maskPhone, maskCPF, maskCNPJ } from '../../utils/masks'
import { useToast } from '../../composables/useToast'

const props = defineProps({
  person: { type: Object, default: null },
})

const emit = defineEmits(['close', 'submit'])

const toast = useToast()

const isEditing = !!props.person

const NAME_MAX_LENGTH = 100
const EMAIL_MAX_LENGTH = 100

const personType = ref(
  props.person?.document && props.person.document.replace(/\D/g, '').length === 14
    ? 'PJ'
    : 'PF'
)

const form = reactive({
  name: props.person?.name ?? '',
  email: props.person?.email ?? '',
  phone: props.person?.phone ?? '',
  document: props.person?.document ?? '',
  gender: props.person?.gender ?? 'O',
  birth_date: props.person?.birth_date ?? '',
})

const originalSnapshot = isEditing
  ? {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone,
      document: form.document,
      gender: form.gender,
      birth_date: form.birth_date,
    }
  : null

function buildComparablePayload() {
  return {
    name: form.name.trim(),
    email: form.email.trim(),
    phone: form.phone,
    document: form.document,
    gender: form.gender,
    birth_date: personType.value === 'PF' ? form.birth_date : '',
  }
}

function hasChanges() {
  if (!originalSnapshot) return true
  const current = buildComparablePayload()
  return Object.keys(current).some((key) => current[key] !== originalSnapshot[key])
}

const phoneModel = computed({
  get: () => maskPhone(form.phone),
  set: (val) => {
    form.phone = val.replace(/\D/g, '').slice(0, 11)
  },
})

function selectPersonType(type) {
  if (personType.value === type) return
  personType.value = type
  form.document = ''
  fieldErrors.value.document = undefined
  if (type === 'PJ') {
    form.birth_date = ''
    fieldErrors.value.birth_date = undefined
  }
}

function selectGender(value) {
  form.gender = value
  fieldErrors.value.gender = undefined
}

const genderOptions = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Feminino' },
  { value: 'O', label: 'Outro' },
]

const DOCUMENT_MAX_LENGTH = computed(() => (personType.value === 'PJ' ? 14 : 11))

const documentModel = computed({
  get: () => (personType.value === 'PJ' ? maskCNPJ(form.document) : maskCPF(form.document)),
  set: (val) => {
    form.document = val.replace(/\D/g, '').slice(0, DOCUMENT_MAX_LENGTH.value)
  },
})

const documentLabel = computed(() => (personType.value === 'PJ' ? 'CNPJ' : 'CPF'))
const documentPlaceholder = computed(() =>
  personType.value === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'
)

const todayISO = new Date().toISOString().split('T')[0]

const sanitizeBirthDateYear = () => {
  if (!form.birth_date) return
  const [year, month, day] = form.birth_date.split('-')
  if (year && year.length > 4) {
    const fixedYear = year.slice(0, 4)
    form.birth_date = [fixedYear, month, day].filter(Boolean).join('-')
  }
}

const fieldErrors = ref({})
const isSubmitting = ref(false)

const handleSubmit = async () => {
  const result = personSchema.safeParse(form)

  if (!result.success) {
    fieldErrors.value = result.error.flatten().fieldErrors
    return
  }

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

  isSubmitting.value = true
  try {
    const payload = {
      ...result.data,
      birth_date: personType.value === 'PF' ? form.birth_date : null,
    }
    await emit('submit', payload)
  } finally {
    isSubmitting.value = false
  }
}

function createLengthGuard(getValue, maxLength) {
  return function (e) {
    if (!e.key) return   // 👈 nova guarda: ignora eventos sem key (autofill, IME, etc.)

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
  if (!e.key) return
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
    if (!e.key) return
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
        <label class="text-sm font-medium text-ink-700">Gênero</label>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="option in genderOptions"
            :key="option.value"
            type="button"
            class="rounded-xl border px-3 py-2 text-sm font-medium transition-colors"
            :class="form.gender === option.value
              ? 'border-brand-500 bg-brand-50 text-brand-700'
              : 'border-surface-border bg-white text-ink-500 hover:bg-ink-50'"
            @click="selectGender(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
        <span v-if="fieldErrors.gender" class="text-xs text-red-600">{{ fieldErrors.gender[0] }}</span>
      </div>

      <div v-if="personType === 'PF'" class="flex flex-col gap-1.5">
        <BaseInput
          v-model="form.birth_date"
          label="Data de nascimento"
          type="date"
          :icon="Calendar"
          :max="todayISO"
          @input="sanitizeBirthDateYear"
        />
        <span v-if="fieldErrors.birth_date" class="text-xs text-red-600">{{ fieldErrors.birth_date[0] }}</span>
      </div>

      <div class="flex flex-col gap-1.5">
        <BaseInput
          v-model="form.email"
          label="E-mail"
          type="email"
          :icon="Mail"
          placeholder="email@exemplo.com"
          :maxlength="EMAIL_MAX_LENGTH"
          @keydown="blockEmailOverflow"
          @input="sanitizeEmailLength"
        />
        <div class="flex items-center justify-between">
          <span v-if="fieldErrors.email" class="text-xs text-red-600">{{ fieldErrors.email[0] }}</span>
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
        <BaseButton type="submit" :disabled="isSubmitting">
          {{ isSubmitting ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Cadastrar' }}
        </BaseButton>
      </div>
    </form>
  </BaseModal>
</template> 