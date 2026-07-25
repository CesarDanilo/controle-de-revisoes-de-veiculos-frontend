// composables/useEmailValidation.js
import { ref } from 'vue'

const API_KEY = import.meta.env.VITE_ABSTRACT_EMAIL_API_KEY

export function useEmailValidation() {
  const isChecking = ref(false)
  const isValid = ref(null) // null = ainda não checado
  const errorMessage = ref('')

  let debounceTimer = null

  async function checkEmail(email) {
    // validação de formato básica antes de gastar cota de API
    const formatRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!formatRegex.test(email)) {
      isValid.value = false
      // 🔴 AQUI — mensagem quando o formato do email está errado (ex: "fulano@" ou "fulano.com")
      errorMessage.value = 'Email digitado inválido'
      return
    }

    isChecking.value = true
    errorMessage.value = ''

    try {
      const res = await fetch(
        `https://emailvalidation.abstractapi.com/v1/?api_key=${API_KEY}&email=${encodeURIComponent(email)}`
      )

      if (!res.ok) throw new Error('Falha na verificação')

      const data = await res.json()

      const deliverable = data.deliverability === 'DELIVERABLE'
      const isDisposable = data.is_disposable_email?.value === true

      isValid.value = deliverable && !isDisposable

      if (!isValid.value) {
        // 🔴 AQUI — mensagem quando é email descartável (temporário)
        if (isDisposable) {
          errorMessage.value = 'Emails temporários não são permitidos'
        }
        // 🔴 AQUI — mensagem quando o domínio/caixa não existe (não recebe emails)
        else {
          errorMessage.value = 'Email digitado inválido'
        }
      }
    } catch (err) {
      // se a API falhar, não bloqueia o usuário — só loga
      console.error('Erro ao validar email:', err)
      isValid.value = null
      errorMessage.value = ''
    } finally {
      isChecking.value = false
    }
  }

  function checkEmailDebounced(email, delay = 800) {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => checkEmail(email), delay)
  }

  return { isChecking, isValid, errorMessage, checkEmail, checkEmailDebounced }
}