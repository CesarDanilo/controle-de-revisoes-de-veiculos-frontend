import { ref } from 'vue'

/**
 * Composable para validar CNPJ contra a BrasilAPI (https://brasilapi.com.br).
 * API pública, gratuita, sem necessidade de chave — por isso é consumida
 * diretamente do frontend, diferente do CPF que passa pelo backend.
 *
 * A BrasilAPI valida o dígito verificador do CNPJ antes de consultar a
 * Receita: CNPJ com formato numericamente inválido -> 400 Bad Request.
 * CNPJ com dígitos válidos mas que não existe na base -> 404 Not Found.
 * Ambos os casos são tratados como 'invalid' aqui.
 *
 * Estados possíveis: 'idle' | 'checking' | 'valid' | 'invalid' | 'error'
 */
export function useCnpjValidation() {
  const status = ref('idle')
  const message = ref('')
  const data = ref(null)
  const lastCheckedCnpj = ref('')

  async function checkCnpj(cnpj) {
    const digits = cnpj.replace(/\D/g, '')

    if (digits.length !== 14) {
      status.value = 'idle'
      message.value = ''
      return
    }

    if (digits === lastCheckedCnpj.value && status.value !== 'idle') {
      return
    }

    status.value = 'checking'
    message.value = ''

    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`)

      lastCheckedCnpj.value = digits

      if (response.status === 400) {
        data.value = null
        status.value = 'invalid'
        message.value = 'CNPJ inválido.'
        return
      }

      if (response.status === 404) {
        data.value = null
        status.value = 'invalid'
        message.value = 'Este CNPJ não foi encontrado na base da Receita Federal.'
        return
      }

      if (!response.ok) {
        throw new Error(`BrasilAPI respondeu com status ${response.status}`)
      }

      const result = await response.json()
      data.value = result
      status.value = 'valid'
      message.value = ''
    } catch (err) {
      status.value = 'error'
      message.value = 'Não foi possível verificar o CNPJ agora. Tente novamente.'
      lastCheckedCnpj.value = ''
      console.error('[useCnpjValidation] ERRO ao validar CNPJ:', err)
    }
  }

  function reset() {
    status.value = 'idle'
    message.value = ''
    data.value = null
    lastCheckedCnpj.value = ''
  }

  return { status, message, data, checkCnpj, reset }
}