import { ref } from 'vue'
import { api } from '../lib/api'

/**
 * Composable para validar email contra o endpoint /api/email/validate (Abstract API).
 *
 * Estados possíveis: 'idle' | 'checking' | 'valid' | 'invalid' | 'error'
 */
export function useEmailValidation() {
  const status = ref('idle')
  const message = ref('')
  const lastCheckedEmail = ref('')

  async function checkEmail(email) {
    const normalized = email.trim().toLowerCase()

    console.log('[useEmailValidation] checkEmail chamado com:', normalized)

    if (!normalized) {
      status.value = 'idle'
      message.value = ''
      console.log('[useEmailValidation] email vazio, status = idle')
      return
    }

    if (normalized === lastCheckedEmail.value && status.value !== 'idle') {
      console.log('[useEmailValidation] email já foi checado antes, ignorando:', normalized)
      return
    }

    status.value = 'checking'
    message.value = ''
    console.log('[useEmailValidation] status = checking, chamando API...')

    try {
      const response = await api.post('/email/validate', { email: normalized })
      console.log('[useEmailValidation] resposta bruta da API:', response)

      const result = response.data.data
      console.log('[useEmailValidation] result.data.data:', result)

      lastCheckedEmail.value = normalized

      const isDeliverable =
        result.is_format_valid &&
        result.deliverability_status === 'deliverable' &&
        !result.is_disposable_email

      console.log('[useEmailValidation] isDeliverable calculado:', isDeliverable, {
        is_format_valid: result.is_format_valid,
        deliverability_status: result.deliverability_status,
        is_disposable_email: result.is_disposable_email,
      })

      if (isDeliverable) {
        status.value = 'valid'
        message.value = ''
      } else if (result.is_disposable_email) {
        status.value = 'invalid'
        message.value = 'Não são permitidos e-mails temporários/descartáveis.'
      } else if (result.deliverability_status === 'undeliverable') {
        status.value = 'invalid'
        message.value = 'Este e-mail parece não existir. Tente outro.'
      } else {
        status.value = 'invalid'
        message.value = 'Não foi possível confirmar que este e-mail é válido.'
      }

      console.log('[useEmailValidation] status final:', status.value, '| message:', message.value)
    } catch (err) {
      status.value = 'error'
      message.value = 'Serviço de verificação de e-mail está indisponível no momento. Tente novamente mais tarde.'
      lastCheckedEmail.value = ''
      console.error('[useEmailValidation] ERRO ao validar email:', err)
      console.error('[useEmailValidation] err.response:', err?.response)
    }
  }

  function reset() {
    console.log('[useEmailValidation] reset() chamado')
    status.value = 'idle'
    message.value = ''
    lastCheckedEmail.value = ''
  }

  return { status, message, checkEmail, reset }
}