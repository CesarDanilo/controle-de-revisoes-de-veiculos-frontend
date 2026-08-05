import { computed, onUnmounted, ref } from 'vue'
import { reportExportService } from '../services/reportExport.service'

const POLL_INTERVAL_MS = 2000
const MAX_POLL_ATTEMPTS = 150 // ~5 minutos, mesmo teto do timeout do Job

export function useReportExport() {
  const isRequesting = ref(false) // aguardando o "pending" -> id
  const isPolling = ref(false)    // aguardando o Job terminar
  const currentType = ref(null)   // tipo em exportação agora (pra saber qual botão está "Gerando...")
  const errorMessage = ref('')

  // 🟢 NOVO — estado do cooldown (429). retryAfter conta em segundos,
  // decrementado a cada 1s até chegar em 0.
  const retryAfter = ref(0)
  const isOnCooldown = computed(() => retryAfter.value > 0)
  let cooldownIntervalId = null

  const stopCooldownCountdown = () => {
    if (cooldownIntervalId) {
      clearInterval(cooldownIntervalId)
      cooldownIntervalId = null
    }
  }

  const startCooldownCountdown = (seconds) => {
    stopCooldownCountdown()
    retryAfter.value = Math.max(0, Math.ceil(seconds))

    cooldownIntervalId = setInterval(() => {
      retryAfter.value -= 1
      if (retryAfter.value <= 0) {
        stopCooldownCountdown()
        retryAfter.value = 0
      }
    }, 1000)
  }

  onUnmounted(stopCooldownCountdown)

  const triggerBrowserDownload = (blob, filename) => {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }

  const waitUntilDone = async (id) => {
    isPolling.value = true
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      const result = await reportExportService.status(id)

      if (result.status === 'done') {
        isPolling.value = false
        return result
      }

      if (result.status === 'failed') {
        isPolling.value = false
        throw new Error(result.error_message || 'Falha ao gerar o relatório.')
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    }
    isPolling.value = false
    throw new Error('O relatório demorou demais para ficar pronto. Tente novamente em instantes.')
  }

  // 🟢 NOVO — extrai uma mensagem legível de qualquer erro (axios ou nativo).
  const resolveErrorMessage = (error) => {
    const backendMessage = error?.response?.data?.error
    if (backendMessage) return backendMessage
    return error.message || 'Não foi possível gerar o relatório.'
  }

  const exportReport = async (type, { start, end, filename } = {}) => {
    // Evita disparar uma segunda exportação enquanto outra ainda está rodando
    // (o composable é compartilhado por todos os botões da tela de Relatórios).
    if (isRequesting.value || isPolling.value || isOnCooldown.value) return

    isRequesting.value = true
    currentType.value = type
    errorMessage.value = ''
    try {
      const { id } = await reportExportService.request(type, { start, end })
      isRequesting.value = false

      await waitUntilDone(id)

      const blob = await reportExportService.downloadBlob(id)
      triggerBrowserDownload(blob, filename || `relatorio-${type}.pdf`)
    } catch (error) {
      // 🔴 NOVO — trata o 429 (cooldown/limite) separadamente: usa a
      // mensagem do backend e inicia a contagem regressiva com o
      // retry_after retornado, em vez do genérico "Request failed
      // with status code 429".
      if (error?.response?.status === 429) {
        const retrySeconds = error.response.data?.retry_after
        errorMessage.value = resolveErrorMessage(error)

        if (retrySeconds) {
          startCooldownCountdown(retrySeconds)
        }

        throw new Error(errorMessage.value)
      }

      errorMessage.value = resolveErrorMessage(error)
      throw new Error(errorMessage.value)
    } finally {
      isRequesting.value = false
      isPolling.value = false
      currentType.value = null
    }
  }

  return {
    exportReport,
    isRequesting,
    isPolling,
    currentType,
    errorMessage,
    retryAfter,     // 🟢 NOVO — segundos restantes do cooldown
    isOnCooldown,   // 🟢 NOVO — true enquanto o cooldown estiver ativo
  }
}