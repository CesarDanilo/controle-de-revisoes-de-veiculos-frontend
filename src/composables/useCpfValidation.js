import { ref } from 'vue'
import { api } from '../lib/api'

/**
 * Composable para validar CPF contra o endpoint /api/cpf/validate (CPFHub).
 *
 * Estados possíveis: 'idle' | 'checking' | 'valid' | 'invalid' | 'error'
 */
export function useCpfValidation() {
  const status = ref('idle')
  const message = ref('')
  const data = ref(null)
  const lastCheckedCpf = ref('')

  async function checkCpf(cpf) {
    const digits = cpf.replace(/\D/g, '')

    console.log('[useCpfValidation] checkCpf chamado com:', digits)

    if (digits.length !== 11) {
      status.value = 'idle'
      message.value = ''
      console.log('[useCpfValidation] CPF com tamanho inválido, status = idle')
      return
    }

    if (digits === lastCheckedCpf.value && status.value !== 'idle') {
      console.log('[useCpfValidation] CPF já checado antes, ignorando:', digits)
      return
    }

    status.value = 'checking'
    message.value = ''
    console.log('[useCpfValidation] status = checking, chamando API...')

    try {
      const response = await api.post('/cpf/validate', { cpf: digits })
      console.log('[useCpfValidation] resposta bruta da API (response.data):', response.data)

      const result = response.data.data
      console.log('[useCpfValidation] result (response.data.data):', result)
      console.log('[useCpfValidation] result.exists:', result?.exists, '| typeof:', typeof result?.exists)

      lastCheckedCpf.value = digits
      data.value = result

      if (result.exists) {
        status.value = 'valid'
        message.value = ''
      } else {
        status.value = 'invalid'
        message.value = 'Este CPF não foi encontrado na base de dados.'
      }

      console.log('[useCpfValidation] status FINAL definido como:', status.value)
    } catch (err) {
        status.value = 'error'
        message.value = 'Não foi possível verificar o CPF agora. Tente novamente.'
        lastCheckedCpf.value = ''
        console.error('[useCpfValidation] ERRO ao validar CPF:', err)
        console.error('[useCpfValidation] err.response?.data:', err?.response?.data)
        console.error('[useCpfValidation] err.response?.status:', err?.response?.status)
    }
  }

  function reset() {
    status.value = 'idle'
    message.value = ''
    data.value = null
    lastCheckedCpf.value = ''
  }

  return { status, message, data, checkCpf, reset }
}