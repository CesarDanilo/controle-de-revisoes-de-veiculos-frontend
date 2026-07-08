<script setup>
import { reactive, ref } from 'vue'
import { User, Mail, Phone, IdCard, Calendar } from '@lucide/vue'
import BaseModal from '../ui/BaseModal.vue'
import BaseInput from '../ui/BaseInput.vue'
import BaseButton from '../ui/BaseButton.vue'
import { personSchema } from '../../schemas/person.schema'

const props = defineProps({
  person: { type: Object, default: null },
})

const emit = defineEmits(['close', 'submit'])

const isEditing = !!props.person

const form = reactive({
  name: props.person?.name ?? '',
  email: props.person?.email ?? '',
  phone: props.person?.phone ?? '',
  document: props.person?.document ?? '',
  birth_date: props.person?.birth_date ?? '',
  gender: props.person?.gender ?? '',
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
  isSubmitting.value = true
  try {
    await emit('submit', result.data)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <BaseModal :title="isEditing ? 'Editar pessoa' : 'Nova pessoa'" @close="emit('close')">
    <form class="flex flex-col gap-4" @submit.prevent="handleSubmit" novalidate>
      <div class="flex flex-col gap-1.5">
        <BaseInput v-model="form.name" label="Nome" :icon="User" placeholder="Nome completo" />
        <span v-if="fieldErrors.name" class="text-xs text-red-600">{{ fieldErrors.name[0] }}</span>
      </div>

      <div class="flex flex-col gap-1.5">
        <BaseInput v-model="form.email" label="E-mail" type="email" :icon="Mail" placeholder="pessoa@exemplo.com" />
        <span v-if="fieldErrors.email" class="text-xs text-red-600">{{ fieldErrors.email[0] }}</span>
      </div>

      <div class="flex flex-col gap-1.5">
        <BaseInput v-model="form.phone" label="Telefone" :icon="Phone" placeholder="(00) 00000-0000" />
        <span v-if="fieldErrors.phone" class="text-xs text-red-600">{{ fieldErrors.phone[0] }}</span>
      </div>

      <div class="flex flex-col gap-1.5">
        <BaseInput v-model="form.document" label="CPF" :icon="IdCard" placeholder="000.000.000-00" />
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