<script setup>
import { ref, computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, AlertCircle, Check, X } from '@lucide/vue'
import { z } from 'zod'
import BaseInput from '../ui/BaseInput.vue'
import BaseButton from '../ui/BaseButton.vue'
import BaseCheckbox from '../ui/BaseCheckbox.vue'
import { loginSchema, registerSchema } from '../../schemas/auth.schema'
import { useAuth } from '../../composables/useAuth'

const router = useRouter()
const { isLoading, errorMessage, login, register } = useAuth()

const mode = ref('login')
const isRegister = computed(() => mode.value === 'register')

const form = reactive({
  name: '',
  email: '',
  password: '',
})

const rememberMe = ref(false)
const showPassword = ref(false)
const fieldErrors = ref({})

// --- Password strength ---
const passwordCriteria = computed(() => ({
  length: form.password.length >= 8,
  uppercase: /[A-Z]/.test(form.password),
  lowercase: /[a-z]/.test(form.password),
  number: /[0-9]/.test(form.password),
  special: /[^A-Za-z0-9]/.test(form.password),
}))

const passwordScore = computed(() => {
  if (!form.password) return 0
  return Object.values(passwordCriteria.value).filter(Boolean).length
})

const passwordStrength = computed(() => {
  const score = passwordScore.value
  if (score === 0) return { label: '', color: '', width: '0%' }
  if (score <= 2) return { label: 'Fraca', color: 'bg-red-500', textColor: 'text-red-600', width: '33%' }
  if (score <= 4) return { label: 'Média', color: 'bg-amber-500', textColor: 'text-amber-600', width: '66%' }
  return { label: 'Forte', color: 'bg-green-500', textColor: 'text-green-600', width: '100%' }
})

const toggleMode = () => {
  mode.value = isRegister.value ? 'login' : 'register'
  showPassword.value = false
  fieldErrors.value = {}
  errorMessage.value = ''
}

const validate = () => {
  const schema = isRegister.value ? registerSchema : loginSchema
  const payload = isRegister.value
    ? { name: form.name, email: form.email, password: form.password }
    : { email: form.email, password: form.password }

  const result = schema.safeParse(payload)

  if (!result.success) {
    fieldErrors.value = result.error.flatten().fieldErrors
    return null
  }

  fieldErrors.value = {}
  return result.data
}

const handleSubmit = async () => {
  const payload = validate()
  if (!payload) return

  try {
    if (isRegister.value) {
      await register(payload)
    } else {
      await login(payload)
    }
    router.push('/painel')
  } catch {
    // errorMessage já foi setado dentro do useAuth
  }
}
</script>

<template>
  <form class="flex flex-col gap-5" @submit.prevent="handleSubmit" novalidate>
    <div
      v-if="errorMessage"
      class="flex items-center gap-2 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-600"
    >
      <AlertCircle :size="16" class="shrink-0" />
      {{ errorMessage }}
    </div>

    <div v-if="isRegister" class="flex flex-col gap-1.5">
      <BaseInput
        v-model="form.name"
        label="Nome"
        type="text"
        placeholder="Seu nome completo"
        autocomplete="name"
        :icon="User"
      />
      <span v-if="fieldErrors.name" class="text-xs text-red-600">
        {{ fieldErrors.name[0] }}
      </span>
    </div>

    <div class="flex flex-col gap-1.5">
      <BaseInput
        v-model="form.email"
        label="E-mail"
        type="email"
        placeholder="voce@exemplo.com"
        autocomplete="username"
        :icon="Mail"
      />
      <span v-if="fieldErrors.email" class="text-xs text-red-600">
        {{ fieldErrors.email[0] }}
      </span>
    </div>

    <div class="flex flex-col gap-1.5">
      <BaseInput
        v-model="form.password"
        label="Senha"
        :type="showPassword ? 'text' : 'password'"
        placeholder="••••••••"
        :autocomplete="isRegister ? 'new-password' : 'current-password'"
        :icon="Lock"
      >
        <template #trailing>
          <button
            type="button"
            class="absolute right-3.5 text-ink-400 transition-colors hover:text-ink-700"
            :aria-label="showPassword ? 'Ocultar senha' : 'Mostrar senha'"
            @click="showPassword = !showPassword"
          >
            <component :is="showPassword ? EyeOff : Eye" :size="18" />
          </button>
        </template>
      </BaseInput>
      <span v-if="fieldErrors.password" class="text-xs text-red-600">
        {{ fieldErrors.password[0] }}
      </span>

      <!-- Password strength indicator: register mode only -->
      <div v-if="isRegister && form.password" class="flex flex-col gap-2 pt-1">
        <div class="flex items-center gap-2">
          <div class="flex h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
            <div
              class="h-full rounded-full transition-all duration-300 ease-out"
              :class="passwordStrength.color"
              :style="{ width: passwordStrength.width }"
            />
          </div>
          <span class="w-10 shrink-0 text-xs font-medium" :class="passwordStrength.textColor">
            {{ passwordStrength.label }}
          </span>
        </div>

        <ul class="grid grid-cols-2 gap-x-3 gap-y-1">
          <li
            class="flex items-center gap-1 text-[11px] transition-colors"
            :class="passwordCriteria.length ? 'text-green-600' : 'text-ink-400'"
          >
            <component :is="passwordCriteria.length ? Check : X" :size="12" class="shrink-0" />
            Mínimo 8 caracteres
          </li>
          <li
            class="flex items-center gap-1 text-[11px] transition-colors"
            :class="passwordCriteria.uppercase ? 'text-green-600' : 'text-ink-400'"
          >
            <component :is="passwordCriteria.uppercase ? Check : X" :size="12" class="shrink-0" />
            Letra maiúscula
          </li>
          <li
            class="flex items-center gap-1 text-[11px] transition-colors"
            :class="passwordCriteria.lowercase ? 'text-green-600' : 'text-ink-400'"
          >
            <component :is="passwordCriteria.lowercase ? Check : X" :size="12" class="shrink-0" />
            Letra minúscula
          </li>
          <li
            class="flex items-center gap-1 text-[11px] transition-colors"
            :class="passwordCriteria.number ? 'text-green-600' : 'text-ink-400'"
          >
            <component :is="passwordCriteria.number ? Check : X" :size="12" class="shrink-0" />
            Número
          </li>
          <li
            class="flex items-center gap-1 text-[11px] transition-colors"
            :class="passwordCriteria.special ? 'text-green-600' : 'text-ink-400'"
          >
            <component :is="passwordCriteria.special ? Check : X" :size="12" class="shrink-0" />
            Caractere especial
          </li>
        </ul>
      </div>
    </div>

    <div v-if="!isRegister" class="flex items-center justify-between">
      <BaseCheckbox v-model="rememberMe" label="Lembrar-me" />
      <a href="#" class="text-sm font-medium text-brand-600 hover:text-brand-500">
        Esqueceu a senha?
      </a>
    </div>

    <BaseButton type="submit" block :disabled="isLoading">
      {{ isLoading ? 'Aguarde...' : isRegister ? 'Criar conta' : 'Entrar' }}
      <ArrowRight :size="16" />
    </BaseButton>

    <p class="text-center text-sm text-ink-500">
      {{ isRegister ? 'Já tem uma conta?' : 'Não tem uma conta?' }}
      <button
        type="button"
        class="font-medium text-brand-600 hover:text-brand-500"
        @click="toggleMode"
      >
        {{ isRegister ? 'Entrar' : 'Criar conta' }}
      </button>
    </p>
  </form>
</template>