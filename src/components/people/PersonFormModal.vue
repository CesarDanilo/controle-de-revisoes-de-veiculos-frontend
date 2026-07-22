<script setup>
import { reactive, ref, computed } from 'vue'
import { User, Mail, Phone, IdCard, Calendar } from '@lucide/vue'
import BaseModal from '../ui/BaseModal.vue'
import BaseInput from '../ui/BaseInput.vue'
import BaseButton from '../ui/BaseButton.vue'
import { personSchema } from '../../schemas/person.schema'
import { maskPhone, maskCPF } from '../../utils/masks'
import { useToast } from '../../composables/useToast'

const props = defineProps({
  person: { type: Object, default: null },
})

const emit = defineEmits(['close', 'submit'])

const toast = useToast()

const isEditing = !!props.person

const form = reactive({
  name: props.person?.name ?? '',
  email: props.person?.email ?? '',
  phone: props.person?.phone ?? '',       // guarda só dígitos
  document: props.person?.document ?? '', // guarda só dígitos
  birth_date: props.person?.birth_date ?? '',
  gender: props.person?.gender ?? '',
})

// ---------- snapshot original (só relevante no modo edição) ----------
// Usado pra comparar "de igual pra igual" no submit e evitar request
// desnecessário quando nada foi alterado.
const originalSnapshot = isEditing
  ? {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone,
      document: form.document,
      birth_date: form.birth_date,
      gender: form.gender,
    }
  : null

function buildComparablePayload() {
  return {
    name: form.name.trim(),
    email: form.email.trim(),
    phone: form.phone,
    document: form.document,
    birth_date: form.birth_date,
    gender: form.gender,
  }
}

function hasChanges() {
  if (!originalSnapshot) return true // criação: sempre "tem mudança" (não há original pra comparar)

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

const documentModel = computed({
  get: () => maskCPF(form.document),
  set: (val) => {
    form.document = val.replace(/\D/g, '').slice(0, 11)
  },
})

const fieldErrors = ref({})
const isSubmitting = ref(false)

const handleSubmit = async () => {
  const result = personSchema.safeParse(form)

  if (!result.success) {
    fieldErrors.value = result.error.flatten().fieldErrors
    return
  }

  fieldErrors.value = {}

  // --- modo edição: só faz o request se algo realmente mudou ---
  if (isEditing && !hasChanges()) {
    toast.info('Nenhuma alteração foi feita.')
    return
  }

  isSubmitting.value = true
  try {
    await emit('submit', result.data)
  } finally {
    isSubmitting.value = false
  }
}

function createNumericGuard(getRawValue, maxLength) {
  return function (e) {
    const controlKeys = [
      'Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight',
      'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter',
    ]
    if (controlKeys.includes(e.key)) return
    if (e.ctrlKey || e.metaKey) return

    // bloqueia qualquer coisa que não seja dígito
    if (!/^\d$/.test(e.key)) {
      e.preventDefault()
      return
    }

    // se o usuário tem texto selecionado, o digito vai substituir a seleção,
    // então não bloqueia mesmo estando no limite
    const target = e.target
    const hasSelection = target.selectionStart !== target.selectionEnd
    if (hasSelection) return

    // bloqueia se já atingiu o limite de dígitos "reais" (sem máscara)
    if (getRawValue().length >= maxLength) {
      e.preventDefault()
    }
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

    // ignora teclas de tamanho > 1 que não sejam impressão de caractere (ex: Shift, CapsLock, F1...)
    if (e.key.length > 1) return

    const target = e.target
    const hasSelection = target.selectionStart !== target.selectionEnd
    if (hasSelection) return

    if (getValue().length >= maxLength) {
      e.preventDefault()
    }
  }
}

const sanitizeNameLength = () => {
  if (form.name.length > 100) {
    form.name = form.name.slice(0, 100)
  }
}

const blockNameOverflow = createLengthGuard(() => form.name, 100)

const blockPhoneOverflow = createNumericGuard(() => form.phone, 11)
const blockDocumentOverflow = createNumericGuard(() => form.document, 11)

</script>

<template>
  <BaseModal :title="isEditing ? 'Editar pessoa' : 'Nova pessoa'" @close="emit('close')">
    <form class="flex flex-col gap-4" @submit.prevent="handleSubmit" novalidate>
      <div class="flex flex-col gap-1.5">
        <BaseInput
          v-model="form.name"
          label="Nome"
          :icon="User"
          placeholder="Nome completo"
          maxlength="100"
          @keydown="blockNameOverflow"
          @input="sanitizeNameLength"
        />
        <span v-if="fieldErrors.name" class="text-xs text-red-600">{{ fieldErrors.name[0] }}</span>
      </div>

      <div class="flex flex-col gap-1.5">
        <BaseInput v-model="form.email" label="E-mail" type="email" :icon="Mail" placeholder="pessoa@exemplo.com" />
        <span v-if="fieldErrors.email" class="text-xs text-red-600">{{ fieldErrors.email[0] }}</span>
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
          label="CPF"
          :icon="IdCard"
          placeholder="000.000.000-00"
          inputmode="numeric"
          maxlength=14
          @keydown="blockDocumentOverflow"
        />
        <span v-if="fieldErrors.document" class="text-xs text-red-600">{{ fieldErrors.document[0] }}</span>
      </div>

      <div class="flex flex-col gap-1.5">
        <BaseInput
          v-model="form.birth_date"
          label="Data de nascimento"
          type="date"
          :icon="Calendar"
        />
        <span v-if="fieldErrors.birth_date" class="text-xs text-red-600">{{ fieldErrors.birth_date[0] }}</span>
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium text-ink-700">Gênero</label>
        <select
          v-model="form.gender"
          class="rounded-xl border border-surface-border bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="" disabled>Selecione</option>
          <option value="M">Masculino</option>
          <option value="F">Feminino</option>
          <option value="O">Outro</option>
        </select>
        <span v-if="fieldErrors.gender" class="text-xs text-red-600">{{ fieldErrors.gender[0] }}</span>
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