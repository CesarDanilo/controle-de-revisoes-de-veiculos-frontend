import { ref } from 'vue'
import { api } from '../lib/api' 

export function useLixeira() {
  const itens = ref([])
  const isLoading = ref(false)
  const errorMessage = ref('')

  const currentPage = ref(1)
  const lastPage = ref(1)
  const total = ref(0)
  const perPage = ref(15)

  const fetchLixeira = async (page = 1, filtros = {}) => {
    isLoading.value = true
    errorMessage.value = ''
    try {
      const resposta = await api.get('/lixeira', {
        params: { page, ...filtros },
      })

      itens.value = resposta.data.data
      currentPage.value = resposta.data.current_page
      lastPage.value = resposta.data.last_page
      total.value = resposta.data.total
      perPage.value = resposta.data.per_page
    } catch (error) {
      console.error('[Lixeira] erro ao buscar:', error)
      errorMessage.value = 'Não foi possível carregar a lixeira.'
    } finally {
      isLoading.value = false
    }
  }

  const restaurarItem = async (id) => {
    await api.post(`/lixeira/${id}/restaurar`)
    itens.value = itens.value.filter((item) => item.id !== id)
    total.value -= 1
  }

  const excluirPermanentemente = async (id) => {
    await api.delete(`/lixeira/${id}`)
    itens.value = itens.value.filter((item) => item.id !== id)
    total.value -= 1
  }

  return {
    itens,
    isLoading,
    errorMessage,
    currentPage,
    lastPage,
    total,
    perPage,
    fetchLixeira,
    restaurarItem,
    excluirPermanentemente,
  }
}