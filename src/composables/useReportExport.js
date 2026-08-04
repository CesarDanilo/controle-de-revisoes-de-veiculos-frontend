import { ref } from 'vue'
import { reportExportService } from '../services/reportExport.service'

const POLL_INTERVAL_MS = 2000
const MAX_POLL_ATTEMPTS = 150 // ~5 minutos, mesmo teto do timeout do Job

export function useReportExport() {
  const isRequesting = ref(false) // aguardando o "pending" -> id
  const isPolling = ref(false)    // aguardando o Job terminar
  const currentType = ref(null)   // tipo em exportação agora (pra saber qual botão está "Gerando...")
  const errorMessage = ref('')

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

  const exportReport = async (type, { start, end, filename } = {}) => {
    // Evita disparar uma segunda exportação enquanto outra ainda está rodando
    // (o composable é compartilhado por todos os botões da tela de Relatórios).
    if (isRequesting.value || isPolling.value) return

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
      errorMessage.value = error.message || 'Não foi possível gerar o relatório.'
      throw error
    } finally {
      isRequesting.value = false
      isPolling.value = false
      currentType.value = null
    }
  }

  return { exportReport, isRequesting, isPolling, currentType, errorMessage }
}