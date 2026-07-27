import { computed, ref } from 'vue'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/vue-query'
import { personService } from '../services/person.service'

export function usePeople() {
  const queryClient = useQueryClient()

  // Estado "de controle" - página atual e filtros ativos.
  // Mudar qualquer um destes gera uma nova queryKey, então o Vue Query
  // sabe automaticamente quando precisa buscar de novo (ou usar cache).
  const page = ref(1)
  const filters = ref({
    name: '',
    email: '',
    phone: '',
    document: '',
  })

  const queryParams = computed(() => {
    const params = { current_page: page.value }

    Object.entries(filters.value).forEach(([key, value]) => {
      if (value && value.trim() !== '') {
        params[key] = value.trim()
      }
    })

    return params
  })

  const {
    data,
    isLoading,
    isFetching,
    error,
  } = useQuery({
    // queryParams entra como parte da chave: cada combinação de
    // página + filtros vira uma entrada de cache separada.
    queryKey: ['people', queryParams],
    queryFn: () => personService.list(queryParams.value),
    // Mantém os dados antigos na tela enquanto busca a nova página/filtro,
    // em vez de piscar um loading vazio a cada mudança.
    placeholderData: keepPreviousData,
  })

  const people = computed(() => data.value?.data ?? [])
  const currentPage = computed(() => data.value?.current_page ?? page.value)
  const lastPage = computed(() => data.value?.last_page ?? 1)
  const total = computed(() => data.value?.total ?? 0)
  const perPage = computed(() => data.value?.per_page ?? 10)
  const errorMessage = computed(() => (error.value ? 'Não foi possível carregar as pessoas.' : ''))

  function fetchPeople(newPage = 1) {
    page.value = newPage
  }

  // Sempre volta pra página 1: uma busca nova não faz sentido continuar
  // na página 3 de uma busca anterior.
  function applyFilters(newFilters) {
    filters.value = { ...filters.value, ...newFilters }
    page.value = 1
  }

  function clearFilters() {
    filters.value = { name: '', email: '', phone: '', document: '' }
    page.value = 1
  }

  // Mutations: qualquer criação/edição/remoção invalida o cache de 'people',
  // forçando o Vue Query a buscar dados atualizados na próxima leitura.
  const createMutation = useMutation({
    mutationFn: (payload) => personService.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['people'] }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => personService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['people'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => personService.remove(id),
    onSuccess: () => {
      // Se era o único item da página atual (e não é a primeira), volta uma página
      // antes de invalidar, pra não ficar numa página vazia.
      if (people.value.length === 1 && page.value > 1) {
        page.value -= 1
      }
      queryClient.invalidateQueries({ queryKey: ['people'] })
    },
  })

  async function createPerson(payload) {
    return createMutation.mutateAsync(payload)
  }

  async function updatePerson(id, payload) {
    return updateMutation.mutateAsync({ id, payload })
  }

  async function deletePerson(id) {
    return deleteMutation.mutateAsync(id)
  }

  return {
    people,
    isLoading,
    isFetching,
    errorMessage,
    currentPage,
    lastPage,
    total,
    perPage,
    fetchPeople,
    applyFilters,
    clearFilters,
    createPerson,
    updatePerson,
    deletePerson,
  }
}