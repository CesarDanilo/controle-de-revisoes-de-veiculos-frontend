<script setup>
import { ref, computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, AlertCircle } from '@lucide/vue'
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