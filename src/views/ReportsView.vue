<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  BarChart3, Car, Users, Wrench, Calendar,
  DollarSign, Receipt, AlertCircle, RefreshCw, Download,
} from '@lucide/vue'
import AppShell from '../components/layout/AppShell.vue'
import EmptyState from '../components/dashboard/EmptyState.vue'
import ReportPanel from '../components/reports/ReportPanel.vue'
import ReportTable from '../components/reports/ReportTable.vue'
import BarChart from '../components/charts/BarChart.vue'
import DoughnutChart from '../components/charts/DoughnutChart.vue'
import KpiCard from '../components/reports/KpiCard.vue'
import RankingList from '../components/reports/RankingList.vue'
import UpcomingRevisionsPanel from '../components/reports/UpcomingRevisionsPanel.vue'
// 🔴 AQUI — mesmo modal já usado na tela de Pessoas e no painel de "Próximas revisões"
import RevisionsModal from '../components/people/RevisionsModal.vue'
// 🔴 AQUI — mesmo modal de cadastro/edição de pessoa usado na tela de Pessoas
import PersonFormModal from '../components/people/PersonFormModal.vue'
// 🔴 AQUI — mesmo modal de veículos (lista + cadastro/edição) usado na tela de Pessoas
import VehicleFormModal from '../components/people/VehicleFormModal.vue'
import { useReports } from '../composables/useReports'
import { usePeople } from '../composables/usePeople'
import { useToast } from '../composables/useToast'
import { useReportPdf } from '../composables/useReportPdf'
import { maskPhone } from '../utils/masks'

const {
  data,
  pagination,
  tableLoading,
  isLoading,
  errorMessage,
  fetchVehicleReports,
  fetchPeopleReports,
  fetchRevisionReports,
  fetchVehiclesByPerson,
  fetchAllPeople,
  fetchRevisionsByPeriod,
  fetchAvgIntervalByPerson,
  fetchUpcomingRevisions, // 🔧 CORRIGIDO — necessário para paginar todas as páginas na exportação
} = useReports()

// 🔴 AQUI — usado apenas para salvar a edição de pessoa aberta a partir dos relatórios
const { updatePerson } = usePeople()
const toast = useToast()
const route = useRoute()

// 🟢 NOVO — geração de PDF vetorial (texto/tabelas reais), sem captura de
// tela. Substitui completamente o antigo fluxo com html2canvas, que
// quebrava (paginação capturada, componentes cortados/não renderizados).
const { exportOverview, exportTable, exportMultiTable, exportFullReport } = useReportPdf()

// ---- Formatação de data dd/mm/aaaa (sem risco de shift de timezone) ----
const formatDateBR = (value) => {
  if (!value) return '—'
  const isoPart = String(value).slice(0, 10)
  const match = isoPart.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return value
  const [, year, month, day] = match
  return `${day}/${month}/${year}`
}

const toISODate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ---- Rótulo de gênero com 3 categorias (M / F / Outros) ----
// 🔧 CORRIGIDO — o backend pode devolver o mesmo "grupo visual" (Outros)
// em mais de uma linha (ex: gender = 'O' para PF que se identifica como
// Outros, e gender = null para PJ, que não tem gênero — colunas
// gender/birth_date são nullable desde a migration
// alter_people_table_add_person_type). Antes, vehiclesByGenderChart e
// peopleByGenderChart faziam um map() 1-para-1 em cima das linhas cruas
// da API: cada linha virava uma fatia própria do doughnut, então 'O' e
// null geravam DUAS fatias cinzas com o mesmo rótulo "Outros" e valores
// diferentes, mesmo só existindo 3 categorias possíveis. Agora
// normalizamos a chave ANTES de montar o gráfico e agregamos (somamos)
// tudo que não for exatamente 'M' ou 'F' num único balde "OTHERS",
// garantindo sempre no máximo 3 fatias.
const GENDER_ORDER = ['M', 'F', 'OTHERS']
const GENDER_LABELS = { M: 'Homens', F: 'Mulheres', OTHERS: 'Outros' }
const GENDER_COLORS = { M: '#6366f1', F: '#f472b6', OTHERS: '#94a3b8' } // slate neutro pra "Outros"

// Qualquer código que não seja exatamente 'M' ou 'F' (inclui 'O', null,
// undefined, string vazia, etc.) cai no mesmo balde "OTHERS".
const normalizeGenderKey = (code) => (code === 'M' || code === 'F' ? code : 'OTHERS')

// Agrupa uma lista de linhas { gender, count } por chave normalizada,
// somando os valores — em vez do map() 1-para-1 que causava a duplicação
// de fatias "Outros" no gráfico.
const aggregateByGender = (rows, countKey = 'count') => {
  const totals = { M: 0, F: 0, OTHERS: 0 }

  rows.forEach((row) => {
    const key = normalizeGenderKey(row.gender)
    totals[key] += Number(row[countKey] || 0)
  })

  return GENDER_ORDER
    .map((key) => ({
      key,
      label: GENDER_LABELS[key],
      value: totals[key],
      color: GENDER_COLORS[key],
    }))
    // Some para não exibir fatia/legenda de valor zero (ex: se ainda não
    // houver nenhuma pessoa/veículo "Outros" cadastrado).
    .filter((entry) => entry.value > 0)
}

// ---------------------------------------------------------------------
// FILTROS RÁPIDOS DE PERÍODO
// ---------------------------------------------------------------------
const PRESETS = [
  { key: 'today', label: 'Hoje', days: 0 },
  { key: '7d', label: '7 dias', days: 6 },
  { key: '30d', label: '30 dias', days: 29 },
  { key: '90d', label: '90 dias', days: 89 },
  { key: 'custom', label: 'Personalizado', days: null },
]

const activePreset = ref('30d')
const periodStart = ref('')
const periodEnd = ref('')

const applyPreset = (preset) => {
  activePreset.value = preset.key
  if (preset.key === 'custom') return

  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - preset.days)

  periodStart.value = toISODate(start)
  periodEnd.value = toISODate(end)
  // Só a tabela de revisões do período depende do filtro de datas —
  // rankings e intervalo médio são "todos os períodos", não precisam recarregar.
  fetchRevisionsByPeriod(periodStart.value, periodEnd.value, 1)
}

const applyCustomPeriod = () => {
  activePreset.value = 'custom'
  fetchRevisionsByPeriod(periodStart.value, periodEnd.value, 1)
}

// ---------------------------------------------------------------------
// CARGA INICIAL
// ---------------------------------------------------------------------
const loadAll = async () => {
  const initialEnd = new Date()
  const initialStart = new Date()
  initialStart.setDate(initialEnd.getDate() - 29)
  periodStart.value = toISODate(initialStart)
  periodEnd.value = toISODate(initialEnd)

  await Promise.all([
    fetchVehicleReports(),
    fetchPeopleReports(),
    fetchRevisionReports(periodStart.value, periodEnd.value),
    fetchAvgIntervalByPerson(),
  ])
}

const hasAnyData = computed(
  () => data.value.allVehicles.length || data.value.allPeople.length
)

// ---------------------------------------------------------------------
// 🟢 NOVO — "CONGELAMENTO" DA TELA DURANTE EXPORTAÇÃO
// ---------------------------------------------------------------------
// PROBLEMA: fetchAllRows (mais abaixo) reaproveita os mesmos fetchers que
// alimentam a tela (fetchRevisionsByPeriod, fetchAllPeople, etc.) pra
// varrer TODAS as páginas antes de gerar o PDF. Só que esses fetchers
// escrevem no MESMO `data`/`pagination` reativo que os KPIs, gráficos e
// tabelas da tela já estão lendo — então, durante a exportação, a tela
// pisca com os valores de cada página intermediária até a página original
// ser restaurada no final. Isso NÃO pode acontecer na frente do cliente.
//
// SOLUÇÃO: assim que QUALQUER exportação começa (isExportingSection deixa
// de ser null), tiramos uma "foto" do estado atual de data/pagination e
// passamos a exibir essa foto congelada em vez do `data`/`pagination` ao
// vivo. Quando a exportação termina, a foto é descartada e a tela volta a
// ler o `data`/`pagination` ao vivo — que nesse ponto já foi restaurado
// pra página original, então a transição é invisível pro usuário.
//
// isExportingSection é declarado aqui em cima (não mais lá embaixo, perto
// dos exportXPDF) justamente para os computeds de KPI/tabela, que vêm
// antes no arquivo, poderem depender dele.
const isExportingSection = ref(null)
const isExporting = computed(() => isExportingSection.value !== null)

const frozenSnapshot = ref(null)

watch(isExportingSection, (newVal, oldVal) => {
  const startedExporting = newVal !== null && oldVal === null
  const finishedExporting = newVal === null && oldVal !== null

  if (startedExporting) {
    frozenSnapshot.value = {
      revisionsByPeriod: data.value.revisionsByPeriod.map((row) => ({ ...row })),
      allPeople: data.value.allPeople.map((row) => ({ ...row })),
      vehiclesByPerson: data.value.vehiclesByPerson.map((row) => ({ ...row })),
      avgIntervalByPerson: data.value.avgIntervalByPerson.map((row) => ({ ...row })),
      upcomingRevisions: data.value.upcomingRevisions.map((row) => ({ ...row })),
      pagination: {
        revisionsByPeriod: { ...pagination.revisionsByPeriod },
        allPeople: { ...pagination.allPeople },
        vehiclesByPerson: { ...pagination.vehiclesByPerson },
        avgIntervalByPerson: { ...pagination.avgIntervalByPerson },
        upcomingRevisions: { ...pagination.upcomingRevisions },
      },
    }
  } else if (finishedExporting) {
    frozenSnapshot.value = null
  }
})

// Tudo que os KPIs/tabelas leem passa a vir daqui. Enquanto não há
// exportação em andamento, é só um espelho de `data`/`pagination` ao vivo.
const displayData = computed(() => frozenSnapshot.value ?? {
  revisionsByPeriod: data.value.revisionsByPeriod,
  allPeople: data.value.allPeople,
  vehiclesByPerson: data.value.vehiclesByPerson,
  avgIntervalByPerson: data.value.avgIntervalByPerson,
  upcomingRevisions: data.value.upcomingRevisions,
})

const displayPagination = computed(() => frozenSnapshot.value?.pagination ?? pagination)

// ---------------------------------------------------------------------
// PAGINAÇÃO — handlers de troca de página por tabela
// ---------------------------------------------------------------------
const handleVehiclesByPersonPage = (page) => fetchVehiclesByPerson(page)
const handleAllPeoplePage = (page) => fetchAllPeople(page)
const handleRevisionsByPeriodPage = (page) =>
  fetchRevisionsByPeriod(periodStart.value, periodEnd.value, page)
const handleAvgIntervalPage = (page) => fetchAvgIntervalByPerson(page)

// ---------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------
// 🔧 CORRIGIDO — lêem de displayData (congelado durante exportação) em vez
// de data.value diretamente, pra não piscar enquanto o PDF é gerado.
const kpiTotalRevisoes = computed(() => displayData.value.revisionsByPeriod.length)

const kpiVeiculosAtendidos = computed(
  () => new Set(displayData.value.revisionsByPeriod.map((r) => r.vehicle)).size
)

const kpiClientesAtendidos = computed(
  () => new Set(displayData.value.revisionsByPeriod.map((r) => r.person_name)).size
)

const kpiCustoTotal = computed(() =>
  displayData.value.revisionsByPeriod.reduce((sum, r) => sum + Number(r.cost || 0), 0)
)

const kpiTicketMedio = computed(() =>
  kpiTotalRevisoes.value ? kpiCustoTotal.value / kpiTotalRevisoes.value : 0
)

const formatCurrency = (value) =>
  Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// 🔧 CORRIGIDO — extraído do computed pra função pura, reaproveitada tanto
// pela tela (paginada, 15 itens por vez) quanto pela exportação em PDF
// (todas as páginas juntas). Antes essa lógica só existia dentro do
// computed, então a exportação não tinha como aplicá-la aos dados
// completos buscados via fetchAllRows.
const buildUpcomingWithStatus = (rows) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const in7days = new Date(today)
  in7days.setDate(today.getDate() + 7)

  return rows
    .map((row) => {
      const predicted = row.predicted_date ? new Date(row.predicted_date) : null
      let status = 'normal'
      if (predicted && predicted < today) status = 'overdue'
      else if (predicted && predicted <= in7days) status = 'soon'

      return {
        ...row,
        predicted_date_label: formatDateBR(row.predicted_date),
        origin_label: row.is_estimated_date ? 'Estimado' : 'Informado',
        status,
        _rawDate: predicted,
      }
    })
    .sort((a, b) => (a._rawDate ?? Infinity) - (b._rawDate ?? Infinity))
}

// 🔧 CORRIGIDO — usa displayData (congelado durante exportação)
const upcomingWithStatus = computed(() => buildUpcomingWithStatus(displayData.value.upcomingRevisions))

const kpiProximasRevisoes = computed(
  () => upcomingWithStatus.value.filter((r) => r.status === 'overdue' || r.status === 'soon').length
)

// ---------------------------------------------------------------------
// TABELAS FORMATADAS
// ---------------------------------------------------------------------
// 🔧 CORRIGIDO — usam displayData (congelado durante exportação)
const revisionsByPeriodFormatted = computed(() =>
  displayData.value.revisionsByPeriod.map((row) => ({ ...row, date: formatDateBR(row.date) }))
)

// Telefone chega do backend só com dígitos (ex: "11987654321"); aplica a
// mesma máscara usada no formulário de cadastro pra exibir "(00) 00000-0000".
const allPeopleFormatted = computed(() =>
  displayData.value.allPeople.map((row) => ({ ...row, phone: maskPhone(row.phone) }))
)

// ---------------------------------------------------------------------
// GRÁFICOS — 3 categorias de gênero
// ---------------------------------------------------------------------
// Não precisam de displayData: essas fontes (vehiclesByGender,
// peopleByGender, brandsByGender, rankings) nunca são tocadas por
// fetchAllRows durante uma exportação — só revisionsByPeriod, allPeople,
// vehiclesByPerson, avgIntervalByPerson e upcomingRevisions são.
//
// 🔧 CORRIGIDO — antes fazia um map() 1-para-1 direto em cima das linhas
// cruas (data.value.vehiclesByGender), o que gerava fatias duplicadas de
// "Outros" quando a API devolvia mais de uma linha caindo nesse grupo
// (gender = 'O' e gender = null vinham como linhas separadas). Agora usa
// aggregateByGender() pra somar tudo isso numa única fatia antes de
// montar o gráfico.
const vehiclesByGenderChart = computed(() => {
  const aggregated = aggregateByGender(data.value.vehiclesByGender)
  return {
    labels: aggregated.map((g) => g.label),
    datasets: [{
      data: aggregated.map((g) => g.value),
      backgroundColor: aggregated.map((g) => g.color),
      borderWidth: 0,
    }],
  }
})

const peopleByGenderChart = computed(() => {
  const aggregated = aggregateByGender(data.value.peopleByGender)
  return {
    labels: aggregated.map((g) => g.label),
    datasets: [{
      data: aggregated.map((g) => g.value),
      backgroundColor: aggregated.map((g) => g.color),
      borderWidth: 0,
    }],
  }
})

const brandsByGenderChart = computed(() => ({
  labels: data.value.brandsByGender.map((b) => b.brand),
  datasets: [
    { label: 'Homens', data: data.value.brandsByGender.map((b) => b.male_count), backgroundColor: '#6366f1', borderRadius: 6 },
    { label: 'Mulheres', data: data.value.brandsByGender.map((b) => b.female_count), backgroundColor: '#f472b6', borderRadius: 6 },
    { label: 'Outros', data: data.value.brandsByGender.map((b) => b.other_count), backgroundColor: '#94a3b8', borderRadius: 6 },
  ],
}))

const brandsRevisionItems = computed(() =>
  data.value.brandsRevisionRanking.map((b) => ({ label: b.brand, value: b.count }))
)
const peopleRevisionItems = computed(() =>
  data.value.peopleRevisionRanking.map((p) => ({ label: p.person_name, value: p.count }))
)

// 🔧 CORRIGIDO — não muda de comportamento (M e F nunca duplicavam, só
// "Outros" duplicava), mas segue lendo direto do array cru
// (data.value.peopleByGender), não do agregado — aqui é busca pontual por
// gênero específico, não soma de grupo.
const avgAgeMale = computed(() => data.value.peopleByGender.find((g) => g.gender === 'M')?.avg_age ?? '—')
const avgAgeFemale = computed(() => data.value.peopleByGender.find((g) => g.gender === 'F')?.avg_age ?? '—')

const detailTabs = [
  { key: 'revisions', label: 'Revisões', icon: Wrench },
  { key: 'vehicles', label: 'Veículos', icon: Car },
  { key: 'people', label: 'Pessoas', icon: Users },
]
const activeDetailTab = ref('revisions')

// ---------------------------------------------------------------------
// SCROLL AUTOMÁTICO PARA SEÇÃO VIA ÂNCORA
// ---------------------------------------------------------------------
// 🟢 NOVO — usado pelos links "Ver relatório" dos StatCards no Dashboard e
// pelo link "Ver relatórios" do UpcomingRevisionsCard.
//
// Duas famílias de âncora:
// - Seções fixas, sempre no DOM: "#proximas-revisoes", "#secao-financeiro"
//   -> só rola até o id.
// - Abas de detalhe, controladas por estado (activeDetailTab), não por
//   rota: "#aba-veiculos", "#aba-pessoas", "#aba-revisoes" -> primeiro
//   troca a aba ativa, só então rola até o container "#secao-detalhes"
//   (só a aba ativa está no DOM por vez, então não dá pra apontar um id
//   fixo direto pra dentro de cada aba).
const TAB_HASH_MAP = {
  '#aba-revisoes': 'revisions',
  '#aba-veiculos': 'vehicles',
  '#aba-pessoas': 'people',
}

// Ajuste HEADER_OFFSET pra bater com a altura real do header sticky do seu
// AppShell (inclua qualquer padding/margem extra que você queira de respiro).
const HEADER_OFFSET = 96

// 🔧 CORRIGIDO — causa raiz do "Pessoas não centraliza": usávamos
// el.scrollIntoView({ block: 'start' }), mas o navegador NÃO CONSEGUE
// rolar além do fim do documento. A aba "Pessoas" tem a tabela mais curta
// (menos colunas/linhas que Veículos e Revisões), então a página como um
// todo às vezes não tem altura suficiente abaixo de "#secao-detalhes" pra
// empurrá-la até o topo do viewport — o scroll para no fim da página,
// deixando a seção baixa/cortada, mesmo que o alvo esteja "certo".
//
// A correção: calculamos a posição manualmente e, se a página não tiver
// espaço suficiente pra rolar até lá, injetamos um espaçador temporário no
// fim da página do tamanho exato que falta — garantindo que sempre exista
// espaço pra centralizar a seção, independente de quão curto seja o
// conteúdo da aba. O espaçador só é removido depois que o scroll de fato
// termina de se mover (não num timeout fixo, que cortaria a animação no
// meio do caminho justamente nas distâncias mais longas, como a de
// "Pessoas").
const scrollSpacerHeight = ref(0)

const waitForScrollToSettle = (target, { tolerance = 2, maxWait = 3000 } = {}) => {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    let lastY = window.scrollY
    let stableFrames = 0

    const check = () => {
      const currentY = window.scrollY
      const reachedTarget = Math.abs(currentY - target) <= tolerance
      const stoppedMoving = Math.abs(currentY - lastY) <= tolerance

      if (reachedTarget || Date.now() - startedAt > maxWait) {
        resolve()
        return
      }

      stableFrames = stoppedMoving ? stableFrames + 1 : 0
      lastY = currentY

      // parou de se mover por vários frames seguidos (ex: bateu no fim da
      // página antes de alcançar o alvo) — não faz sentido continuar esperando
      if (stableFrames > 10) {
        resolve()
        return
      }

      requestAnimationFrame(check)
    }

    requestAnimationFrame(check)
  })
}

const scrollToTarget = async (targetId) => {
  const el = document.getElementById(targetId)
  if (!el) return

  const desiredTop = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET
  const maxScrollTop = document.documentElement.scrollHeight - window.innerHeight
  const missing = desiredTop - maxScrollTop

  if (missing > 0) {
    // +24px de folga, pra não parar bem na borda
    scrollSpacerHeight.value = Math.ceil(missing) + 24
    // espera o espaçador entrar no DOM antes de calcular o scroll máximo de novo
    await nextTick()
  }

  const target = Math.max(desiredTop, 0)
  window.scrollTo({ top: target, behavior: 'smooth' })

  // só remove o espaçador depois que o scroll de fato assentou no alvo —
  // nada de timeout fixo, que cortaria distâncias longas no meio do caminho
  await waitForScrollToSettle(target)
  scrollSpacerHeight.value = 0
}

const scrollToHashSection = async () => {
  if (!route.hash) return

  const tabKey = TAB_HASH_MAP[route.hash]
  if (tabKey) activeDetailTab.value = tabKey

  await nextTick()
  const targetId = tabKey ? 'secao-detalhes' : route.hash.slice(1)
  await scrollToTarget(targetId)
}

// cobre o caso de vir de outra rota com o hash já na URL, ou de já estar em
// /relatorios e clicar de novo no link (o hash muda mas o componente não remonta)
watch(() => route.hash, scrollToHashSection)

// cobre o caso de a página já estar carregada (ex: cache do vue-query) e o
// hash já vir presente logo no mount
watch(isLoading, (loading) => {
  if (!loading) scrollToHashSection()
})

// ---------------------------------------------------------------------
// MODAL DE REVISÕES — aberto ao clicar em uma linha das tabelas de revisões
// ---------------------------------------------------------------------
const isRevisionsModalOpen = ref(false)
const selectedPerson = ref(null)
const highlightVehicleId = ref(null)
const highlightRevisionId = ref(null)

const openRevisionsModal = ({ personId, personName, vehicleId = null, revisionId = null }) => {
  if (!personId) return // sem person_id não dá pra abrir o modal
  selectedPerson.value = { id: personId, name: personName }
  highlightVehicleId.value = vehicleId
  highlightRevisionId.value = revisionId
  isRevisionsModalOpen.value = true
}

const closeRevisionsModal = () => {
  isRevisionsModalOpen.value = false
  selectedPerson.value = null
  highlightVehicleId.value = null
  highlightRevisionId.value = null
}

// "Tempo médio entre revisões" — sem revisão específica, abre a listagem normal da pessoa
const handleAvgIntervalRowClick = (row) => {
  openRevisionsModal({ personId: row.person_id, personName: row.person_name })
}

// "Revisões no período selecionado" — tem a revisão exata, abre já em modo edição
const handleRevisionsByPeriodRowClick = (row) => {
  openRevisionsModal({
    personId: row.person_id,
    personName: row.person_name,
    vehicleId: row.vehicle_id,
    revisionId: row.revision_id,
  })
}

// ---------------------------------------------------------------------
// MODAL DE CADASTRO/EDIÇÃO DE PESSOA — aberto ao clicar em uma linha da aba "Pessoas"
// ---------------------------------------------------------------------
const isPersonModalOpen = ref(false)
const editingPerson = ref(null)
const isSubmittingPerson = ref(false)

const openPersonModal = (person) => {
  editingPerson.value = person
  isPersonModalOpen.value = true
}

const closePersonModal = () => {
  isPersonModalOpen.value = false
  editingPerson.value = null
}

const handlePersonSubmit = async (payload) => {
  isSubmittingPerson.value = true
  try {
    await updatePerson(editingPerson.value.id, payload)
    toast.success('Pessoa atualizada com sucesso!')
    closePersonModal()
    // recarrega a página atual da tabela pra refletir a edição
    await fetchAllPeople(pagination.allPeople.currentPage)
  } catch (error) {
    const rawMessage = error.response?.data?.message ?? error.response?.data?.error
    toast.error(rawMessage || 'Não foi possível salvar a pessoa.')
  } finally {
    isSubmittingPerson.value = false
  }
}

// "Todas as pessoas" — abre o modal de edição da pessoa clicada
const handleAllPeopleRowClick = (row) => {
  openPersonModal(row)
}

// ---------------------------------------------------------------------
// MODAL DE VEÍCULOS DA PESSOA — aberto ao clicar em uma linha da aba "Veículos",
// já em modo edição do veículo clicado
// ---------------------------------------------------------------------
const isVehicleModalOpen = ref(false)
const personForVehicle = ref(null)
const highlightVehicleIdForModal = ref(null)

const openVehicleModal = (person, vehicleId = null) => {
  personForVehicle.value = person
  highlightVehicleIdForModal.value = vehicleId
  isVehicleModalOpen.value = true
}

const closeVehicleModal = async () => {
  isVehicleModalOpen.value = false
  personForVehicle.value = null
  highlightVehicleIdForModal.value = null
  // recarrega a página atual da tabela pra refletir qualquer edição feita no modal
  await fetchVehiclesByPerson(pagination.vehiclesByPerson.currentPage)
}

// "Todos os veículos por pessoa" — abre o modal já em edição no veículo clicado
const handleVehiclesByPersonRowClick = (row) => {
  openVehicleModal({ id: row.person_id, name: row.person_name }, row.vehicle_id)
}

// ---------------------------------------------------------------------
// EXPORTAÇÃO EM PDF — agora 100% vetorial (jsPDF + autoTable), sem
// html2canvas. Cada botão dispara um PDF diferente, todos SEM a
// paginação de 10-em-10 da tela: buscamos TODOS os registros antes de
// gerar o arquivo.
//
// 🔧 CORRIGIDO — isExportingSection foi movido pra cima (perto de
// displayData/frozenSnapshot), não é mais declarado aqui. O resto da
// lógica de exportação continua igual.
// ---------------------------------------------------------------------

const withExportLoading = async (key, task) => {
  if (isExportingSection.value) return
  isExportingSection.value = key
  try {
    await task()
  } catch (error) {
    console.error(`Erro ao exportar "${key}":`, error)
    toast.error(`Não foi possível gerar o PDF: ${error?.message || 'erro desconhecido'}`)
  } finally {
    isExportingSection.value = null
  }
}

// 🔴 AQUI — os fetchers de useReports() são paginados (retornam só uma
// página por vez, sobrescrevendo data.value.X). Pra exportar TODOS os
// registros sem paginação, buscamos página por página e acumulamos aqui,
// depois restauramos a página que o usuário estava vendo na tela. Isso
// continua escrevendo no data/pagination "ao vivo" — mas agora, como a
// tela lê de displayData/displayPagination (congelados durante a
// exportação), essas escritas intermediárias não aparecem visualmente.
// O ideal a longo prazo é um endpoint dedicado no backend que devolva
// tudo de uma vez (mais eficiente que N requisições), mas isso já
// resolve sem precisar mexer na API agora.
const fetchAllRows = async (fetchPage, getRows, getPagination, restorePage) => {
  const collected = []
  let page = 1

  await fetchPage(page)
  collected.push(...getRows())
  const lastPage = getPagination()?.lastPage ?? 1

  for (page = 2; page <= lastPage; page++) {
    await fetchPage(page)
    collected.push(...getRows())
  }

  if (restorePage) await fetchPage(restorePage)
  return collected
}

const buildOverviewPayload = () => ({
  kpis: [
    { label: 'Revisões', value: String(kpiTotalRevisoes.value) },
    { label: 'Veículos atendidos', value: String(kpiVeiculosAtendidos.value) },
    { label: 'Clientes atendidos', value: String(kpiClientesAtendidos.value) },
    { label: 'Próximas revisões (atrasadas/próx. 7 dias)', value: String(kpiProximasRevisoes.value) },
    { label: 'Custo total', value: formatCurrency(kpiCustoTotal.value) },
    { label: 'Ticket médio', value: formatCurrency(kpiTicketMedio.value) },
  ],
  brandsRanking: brandsRevisionItems.value,
  peopleRanking: peopleRevisionItems.value,
  // 🔧 CORRIGIDO — usa aggregateByGender pra evitar duas linhas "Outros"
  // também na quebra por gênero exportada no PDF de visão geral.
  genderBreakdown: [
    ...aggregateByGender(data.value.vehiclesByGender).map((g) => ['Veículos', g.label, String(g.value)]),
    ...aggregateByGender(data.value.peopleByGender).map((g) => ['Pessoas', g.label, String(g.value)]),
  ],
})

// 1) Visão geral (KPIs + rankings + quebra por gênero)
const exportOverviewPDF = () => withExportLoading('overview', () => {
  exportOverview(buildOverviewPayload())
})

// 2) Próximas revisões
// 🔧 CORRIGIDO — esse painel É paginado no backend (15 por página). O
// código antigo exportava só `upcomingWithStatus.value` (a página atual
// em tela), o que gerava um PDF com apenas 15 itens mesmo havendo mais
// páginas. Agora busca TODAS as páginas via fetchAllRows — igual às
// exportações de veículos/pessoas/revisões — aplica buildUpcomingWithStatus
// no conjunto completo, e restaura a página que estava sendo exibida.
const exportUpcomingRevisionsPDF = () => withExportLoading('upcoming', async () => {
  const originalPage = pagination.upcomingRevisions.currentPage
  const rawRows = await fetchAllRows(
    (page) => fetchUpcomingRevisions(page),
    () => data.value.upcomingRevisions,
    () => pagination.upcomingRevisions,
    originalPage,
  )

  exportTable({
    title: 'Próximas revisões',
    filenamePrefix: 'proximas-revisoes',
    columns: [
      { key: 'person_name', label: 'Pessoa' },
      { key: 'vehicle', label: 'Veículo' },
      { key: 'predicted_date_label', label: 'Previsão' },
      { key: 'origin_label', label: 'Origem' },
    ],
    rows: buildUpcomingWithStatus(rawRows),
  })
})

// 2b) Revisões no período selecionado — tabela isolada, com TODOS os
// registros do período filtrado (sem a paginação de 10-em-10 da tela).
// 🟢 NOVO — antes essa tabela só saía combinada dentro do PDF de
// "Revisões" (botão da barra de abas, exportRevisionsTablePDF, que junta
// intervalo médio + período). Este botão exporta só ela, isolada, igual
// ao padrão do card "Próximas revisões".
const exportRevisionsByPeriodPDF = () => withExportLoading('periodRevisions', async () => {
  const originalPeriodPage = pagination.revisionsByPeriod.currentPage
  const periodRows = await fetchAllRows(
    (page) => fetchRevisionsByPeriod(periodStart.value, periodEnd.value, page),
    () => data.value.revisionsByPeriod.map((row) => ({ ...row, date: formatDateBR(row.date) })),
    () => pagination.revisionsByPeriod,
    originalPeriodPage,
  )

  exportTable({
    title: 'Revisões no período selecionado',
    filenamePrefix: 'revisoes-periodo',
    columns: [
      { key: 'date', label: 'Data' },
      { key: 'person_name', label: 'Pessoa' },
      { key: 'vehicle', label: 'Veículo' },
      { key: 'description', label: 'Descrição' },
    ],
    rows: periodRows,
  })
})

// 3) Revisões — combina "tempo médio entre revisões" + "revisões no período", TUDO sem paginação
const exportRevisionsTablePDF = () => withExportLoading('revisions', async () => {
  const originalAvgPage = pagination.avgIntervalByPerson.currentPage
  const avgRows = await fetchAllRows(
    (page) => fetchAvgIntervalByPerson(page),
    () => data.value.avgIntervalByPerson,
    () => pagination.avgIntervalByPerson,
    originalAvgPage,
  )

  const originalPeriodPage = pagination.revisionsByPeriod.currentPage
  const periodRows = await fetchAllRows(
    (page) => fetchRevisionsByPeriod(periodStart.value, periodEnd.value, page),
    () => data.value.revisionsByPeriod.map((row) => ({ ...row, date: formatDateBR(row.date) })),
    () => pagination.revisionsByPeriod,
    originalPeriodPage,
  )

  exportMultiTable({
    title: 'Revisões',
    subtitle: `Período: ${formatDateBR(periodStart.value)} a ${formatDateBR(periodEnd.value)}`,
    filenamePrefix: 'revisoes',
    sections: [
      {
        title: 'Tempo médio entre revisões (por pessoa)',
        columns: [
          { key: 'person_name', label: 'Pessoa' },
          { key: 'avg_days', label: 'Média (dias)' },
        ],
        rows: avgRows,
      },
      {
        title: 'Revisões no período selecionado',
        columns: [
          { key: 'date', label: 'Data' },
          { key: 'person_name', label: 'Pessoa' },
          { key: 'vehicle', label: 'Veículo' },
          { key: 'description', label: 'Descrição' },
        ],
        rows: periodRows,
      },
    ],
  })
})

// 4) Veículos — todos os registros, sem paginação
const exportVehiclesTablePDF = () => withExportLoading('vehicles', async () => {
  const originalPage = pagination.vehiclesByPerson.currentPage
  const rows = await fetchAllRows(
    (page) => fetchVehiclesByPerson(page),
    () => data.value.vehiclesByPerson,
    () => pagination.vehiclesByPerson,
    originalPage,
  )

  exportTable({
    title: 'Todos os veículos por pessoa',
    filenamePrefix: 'veiculos',
    columns: [
      { key: 'person_name', label: 'Proprietário' },
      { key: 'plate', label: 'Placa' },
      { key: 'model', label: 'Modelo' },
      { key: 'brand', label: 'Marca' },
    ],
    rows,
  })
})

// 5) Pessoas — todos os registros, sem paginação
const exportPeopleTablePDF = () => withExportLoading('people', async () => {
  const originalPage = pagination.allPeople.currentPage
  const rows = await fetchAllRows(
    (page) => fetchAllPeople(page),
    () => data.value.allPeople.map((row) => ({ ...row, phone: maskPhone(row.phone) })),
    () => pagination.allPeople,
    originalPage,
  )

  exportTable({
    title: 'Todas as pessoas',
    filenamePrefix: 'pessoas',
    columns: [
      { key: 'name', label: 'Nome' },
      { key: 'email', label: 'E-mail' },
      { key: 'phone', label: 'Telefone' },
    ],
    rows,
  })
})

// 6) Relatório completo — visão geral + as 4 tabelas, tudo num único PDF, sem paginação
const exportFullReportPDF = () => withExportLoading('full', async () => {
  const overviewPayload = buildOverviewPayload()

  const originalAvgPage = pagination.avgIntervalByPerson.currentPage
  const avgRows = await fetchAllRows(
    (page) => fetchAvgIntervalByPerson(page),
    () => data.value.avgIntervalByPerson,
    () => pagination.avgIntervalByPerson,
    originalAvgPage,
  )

  const originalPeriodPage = pagination.revisionsByPeriod.currentPage
  const periodRows = await fetchAllRows(
    (page) => fetchRevisionsByPeriod(periodStart.value, periodEnd.value, page),
    () => data.value.revisionsByPeriod.map((row) => ({ ...row, date: formatDateBR(row.date) })),
    () => pagination.revisionsByPeriod,
    originalPeriodPage,
  )

  const originalVehiclesPage = pagination.vehiclesByPerson.currentPage
  const vehicleRows = await fetchAllRows(
    (page) => fetchVehiclesByPerson(page),
    () => data.value.vehiclesByPerson,
    () => pagination.vehiclesByPerson,
    originalVehiclesPage,
  )

  const originalPeoplePage = pagination.allPeople.currentPage
  const peopleRows = await fetchAllRows(
    (page) => fetchAllPeople(page),
    () => data.value.allPeople.map((row) => ({ ...row, phone: maskPhone(row.phone) })),
    () => pagination.allPeople,
    originalPeoplePage,
  )

  exportFullReport({
    overview: overviewPayload,
    tables: [
      {
        title: 'Tempo médio entre revisões (por pessoa)',
        columns: [
          { key: 'person_name', label: 'Pessoa' },
          { key: 'avg_days', label: 'Média (dias)' },
        ],
        rows: avgRows,
      },
      {
        title: 'Revisões no período selecionado',
        columns: [
          { key: 'date', label: 'Data' },
          { key: 'person_name', label: 'Pessoa' },
          { key: 'vehicle', label: 'Veículo' },
          { key: 'description', label: 'Descrição' },
        ],
        rows: periodRows,
      },
      {
        title: 'Todos os veículos por pessoa',
        columns: [
          { key: 'person_name', label: 'Proprietário' },
          { key: 'plate', label: 'Placa' },
          { key: 'model', label: 'Modelo' },
          { key: 'brand', label: 'Marca' },
        ],
        rows: vehicleRows,
      },
      {
        title: 'Todas as pessoas',
        columns: [
          { key: 'name', label: 'Nome' },
          { key: 'email', label: 'E-mail' },
          { key: 'phone', label: 'Telefone' },
        ],
        rows: peopleRows,
      },
    ],
  })
})

// 🟢 NOVO — qual export usar/qual chave de loading checar, de acordo com a
// aba de detalhe ativa no momento (usado no botão da barra de abas)
const activeTabExportHandler = computed(() => {
  if (activeDetailTab.value === 'vehicles') return exportVehiclesTablePDF
  if (activeDetailTab.value === 'people') return exportPeopleTablePDF
  return exportRevisionsTablePDF
})

const activeTabExportKey = computed(() => {
  if (activeDetailTab.value === 'vehicles') return 'vehicles'
  if (activeDetailTab.value === 'people') return 'people'
  return 'revisions'
})

// 🟢 NOVO — rótulo em português da aba ativa, só para exibição no botão.
// activeTabExportKey continua em inglês porque é comparado com
// isExportingSection (chave interna usada em withExportLoading).
const activeTabExportLabel = computed(() => {
  if (activeDetailTab.value === 'vehicles') return 'Veículos'
  if (activeDetailTab.value === 'people') return 'Pessoas'
  return 'Revisões'
})
// --- fim exportação PDF ---

onMounted(loadAll)
</script>

<template>
  <AppShell title="Relatórios" subtitle="Visão geral do sistema e histórico de revisões.">
    <template #actions>
      <button
        v-if="!isLoading && hasAnyData"
        type="button"
        class="flex w-full items-center justify-center gap-2 rounded-xl cursor-pointer bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        :disabled="isExporting"
        @click="exportFullReportPDF"
      >
        <RefreshCw v-if="isExportingSection === 'full'" :size="16" class="animate-spin" />
        <Download v-else :size="16" />
        {{ isExportingSection === 'full' ? 'Gerando PDF...' : 'Exportar relatório completo' }}
      </button>
    </template>

    <div
      v-if="errorMessage"
      class="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
      role="alert"
    >
      <span class="flex items-center gap-2">
        <AlertCircle :size="16" />
        {{ errorMessage }}
      </span>
      <button
        type="button"
        class="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        @click="loadAll"
      >
        <RefreshCw :size="12" />
        Tentar novamente
      </button>
    </div>

    <EmptyState
      v-else-if="!isLoading && !hasAnyData"
      :icon="BarChart3"
      title="Sem dados suficientes"
      description="Os relatórios aparecerão aqui assim que houver pessoas, veículos e revisões cadastrados."
    />

    <template v-else>
      <div>
        <!-- ====== FILTROS RÁPIDOS + EXPORTAR VISÃO GERAL ====== -->
        <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Período do relatório">
            <button
              v-for="preset in PRESETS"
              :key="preset.key"
              type="button"
              class="rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
              :class="
                activePreset === preset.key
                  ? 'bg-brand-600 text-white'
                  : 'border border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
              "
              :aria-pressed="activePreset === preset.key"
              @click="applyPreset(preset)"
            >
              {{ preset.label }}
            </button>

            <template v-if="activePreset === 'custom'">
              <input v-model="periodStart" type="date" class="rounded-lg border border-ink-200 px-3 py-1.5 text-xs" aria-label="Data inicial" />
              <span class="text-xs text-ink-400">até</span>
              <input v-model="periodEnd" type="date" class="rounded-lg border border-ink-200 px-3 py-1.5 text-xs" aria-label="Data final" />
              <button
                type="button"
                class="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
                @click="applyCustomPeriod"
              >
                <Calendar :size="13" />
                Aplicar
              </button>
            </template>
          </div>

          <!-- 🟢 NOVO — exporta só KPIs + rankings + quebra por gênero -->
          <!-- 🔧 CORRIGIDO — :disabled agora usa isExporting (qualquer
               exportação em andamento), não só isExportingSection === 'overview'.
               Antes, se outra exportação estivesse rodando, esse botão parecia
               clicável mas o clique não fazia nada (bloqueado silenciosamente
               em withExportLoading). Agora ele fica visualmente desabilitado
               nesse caso, dando feedback real ao usuário. -->
          <button
            type="button"
            class="flex shrink-0 items-center gap-1.5 rounded-lg cursor-pointer hover:bg-amber-50/50 border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600 transition-colors  disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            :disabled="isExporting"
            @click="exportOverviewPDF"
          >
            <RefreshCw v-if="isExportingSection === 'overview'" :size="13" class="animate-spin" />
            <Download v-else :size="13" />
            {{ isExportingSection === 'overview' ? 'Gerando...' : 'Baixar visão geral (PDF)' }}
          </button>
        </div>

        <!-- ====== KPIs ====== -->
        <!-- 🟢 id usado como âncora de scroll (#secao-financeiro),
             alvo do card "Investido" no Dashboard -->
        <div
          id="secao-financeiro"
          class="mb-8 scroll-mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))"
        >
          <KpiCard label="Revisões" :value="kpiTotalRevisoes" :icon="Wrench" accent="brand" :loading="isLoading" />
          <KpiCard label="Veículos atendidos" :value="kpiVeiculosAtendidos" :icon="Car" accent="neutral" :loading="isLoading" />
          <KpiCard label="Clientes atendidos" :value="kpiClientesAtendidos" :icon="Users" accent="neutral" :loading="isLoading" />
          <KpiCard
            label="Próximas revisões"
            :value="kpiProximasRevisoes"
            :icon="AlertCircle"
            :accent="kpiProximasRevisoes > 0 ? 'warning' : 'success'"
            hint="atrasadas ou nos próx. 7 dias"
            :loading="isLoading"
          />
          <KpiCard label="Custo total" :value="formatCurrency(kpiCustoTotal)" :icon="DollarSign" accent="success" :loading="isLoading" />
          <KpiCard label="Ticket médio" :value="formatCurrency(kpiTicketMedio)" :icon="Receipt" accent="brand" :loading="isLoading" />
        </div>

        <!-- ====== RANKINGS ====== -->
        <div class="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ReportPanel title="Marcas com mais revisões" description="Todos os períodos">
            <RankingList :items="brandsRevisionItems" accent-class="bg-green-500" />
          </ReportPanel>

          <ReportPanel title="Clientes mais frequentes" description="Todos os períodos">
            <RankingList :items="peopleRevisionItems" accent-class="bg-amber-500" />
          </ReportPanel>
        </div>

        <!-- ====== GRÁFICOS DE GÊNERO ====== -->
        <div class="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ReportPanel title="Veículos por gênero" description="Todos os períodos">
            <DoughnutChart :chart-data="vehiclesByGenderChart" />
          </ReportPanel>

          <ReportPanel title="Pessoas por gênero" description="Todos os períodos">
            <DoughnutChart :chart-data="peopleByGenderChart" />
            <p class="mt-3 text-center text-xs text-ink-400">
              Idade média — homens: {{ avgAgeMale }} anos · mulheres: {{ avgAgeFemale }} anos
            </p>
          </ReportPanel>

          <ReportPanel title="Marcas por gênero" description="Todos os períodos">
            <BarChart :chart-data="brandsByGenderChart" />
          </ReportPanel>
        </div>

        <!-- ====== ALERTAS / PRÓXIMAS REVISÕES ====== -->
        <!-- 🟢 id usado como âncora de scroll (#proximas-revisoes),
             alvo do link "Ver relatórios" no UpcomingRevisionsCard e do
             card "Revisões" no Dashboard -->
        <ReportPanel
          id="proximas-revisoes"
          title="Próximas revisões"
          description="Valor informado no cadastro ou, na ausência dele, estimativa com base no histórico do veículo."
          class="mb-8 scroll-mt-6"
        >
          <div class="mb-3 flex justify-end">
            <!-- 🔧 CORRIGIDO — :disabled agora usa isExporting -->
            <button
              type="button"
              class="flex items-center gap-1.5 rounded-lg cursor-pointer hover:bg-amber-50/50 border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600 transition-colors hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              :disabled="isExporting"
              @click="exportUpcomingRevisionsPDF"
            >
              <RefreshCw v-if="isExportingSection === 'upcoming'" :size="13" class="animate-spin" />
              <Download v-else :size="13" />
              {{ isExportingSection === 'upcoming' ? 'Gerando...' : 'Baixar PDF' }}
            </button>
          </div>
          <UpcomingRevisionsPanel :items="upcomingWithStatus" />
        </ReportPanel>
      </div>

      <!-- ====== TABELAS DETALHADAS ====== -->
      <!-- 🟢 NOVO — id usado como âncora de scroll ("#secao-detalhes"),
           alvo indireto dos cards "Pessoas" e "Veículos" no Dashboard.
           Eles apontam pra "#aba-pessoas" / "#aba-veiculos", que trocam
           activeDetailTab (ver TAB_HASH_MAP) e então rolam pra cá. -->
      <div id="secao-detalhes" class="scroll-mt-6">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-ink-100">
          <div class="flex gap-2">
            <button
              v-for="tab in detailTabs"
              :key="tab.key"
              type="button"
              class="flex items-center gap-2 border-b-2 px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
              :class="
                activeDetailTab === tab.key
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-ink-400 hover:text-ink-700'
              "
              :aria-pressed="activeDetailTab === tab.key"
              @click="activeDetailTab = tab.key"
            >
              <component :is="tab.icon" :size="15" />
              {{ tab.label }}
            </button>
          </div>

          <!-- 🟢 NOVO — exporta a aba de detalhe ativa no momento, com TODOS
               os registros (sem a paginação de 10-em-10 da tabela na tela) -->
          <!-- 🔧 CORRIGIDO — :disabled agora usa isExporting -->
          <button
            type="button"
            class="mb-2 flex shrink-0 items-center gap-1.5 rounded-lg cursor-pointer hover:bg-amber-50/50 border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600 transition-colors hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            :disabled="isExporting"
            @click="activeTabExportHandler()"
          >
            <RefreshCw v-if="isExportingSection === activeTabExportKey" :size="13" class="animate-spin" />
            <Download v-else :size="13" />
            {{ isExportingSection === activeTabExportKey ? 'Gerando...' : 'Baixar PDF - ' + activeTabExportLabel }}
          </button>
        </div>

        <div>
          <div v-if="activeDetailTab === 'revisions'" class="flex flex-col gap-6">
            <ReportPanel title="Tempo médio entre revisões" description="Média de dias entre visitas, por pessoa (considerando todos os veículos dela)">
              <ReportTable
                :columns="[
                  { key: 'person_name', label: 'Pessoa' },
                  { key: 'avg_days', label: 'Média (dias)' },
                ]"
                :rows="displayData.avgIntervalByPerson"
                :pagination="displayPagination.avgIntervalByPerson"
                :loading="tableLoading.avgIntervalByPerson"
                row-clickable
                @page-change="handleAvgIntervalPage"
                @row-click="handleAvgIntervalRowClick"
              />
            </ReportPanel>

            <ReportPanel title="Revisões no período selecionado">
              <div class="mb-3 flex justify-end">
                <!-- 🔧 CORRIGIDO — :disabled agora usa isExporting -->
                <button
                  type="button"
                  class="flex items-center gap-1.5 rounded-lg cursor-pointer hover:bg-amber-50/50 border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600 transition-colors hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  :disabled="isExporting"
                  @click="exportRevisionsByPeriodPDF"
                >
                  <RefreshCw v-if="isExportingSection === 'periodRevisions'" :size="13" class="animate-spin" />
                  <Download v-else :size="13" />
                  {{ isExportingSection === 'periodRevisions' ? 'Gerando...' : 'Baixar PDF' }}
                </button>
              </div>
              <p v-if="!revisionsByPeriodFormatted.length" class="py-6 text-center text-sm text-ink-400">
                Nenhuma revisão encontrada nesse período.
              </p>
              <ReportTable
                v-else
                :columns="[
                  { key: 'date', label: 'Data' },
                  { key: 'person_name', label: 'Pessoa' },
                  { key: 'vehicle', label: 'Veículo' },
                  { key: 'description', label: 'Descrição' },
                ]"
                :rows="revisionsByPeriodFormatted"
                :pagination="displayPagination.revisionsByPeriod"
                :loading="tableLoading.revisionsByPeriod"
                row-clickable
                @page-change="handleRevisionsByPeriodPage"
                @row-click="handleRevisionsByPeriodRowClick"
              />
            </ReportPanel>
          </div>

          <ReportPanel v-else-if="activeDetailTab === 'vehicles'" title="Todos os veículos por pessoa">
            <ReportTable
              :columns="[
                { key: 'person_name', label: 'Proprietário' },
                { key: 'plate', label: 'Placa' },
                { key: 'model', label: 'Modelo' },
                { key: 'brand', label: 'Marca' },
              ]"
              :rows="displayData.vehiclesByPerson"
              :pagination="displayPagination.vehiclesByPerson"
              :loading="tableLoading.vehiclesByPerson"
              row-clickable
              @page-change="handleVehiclesByPersonPage"
              @row-click="handleVehiclesByPersonRowClick"
            />
          </ReportPanel>

          <ReportPanel v-else title="Todas as pessoas">
            <ReportTable
              :columns="[
                { key: 'name', label: 'Nome' },
                { key: 'email', label: 'E-mail' },
                { key: 'phone', label: 'Telefone' },
              ]"
              :rows="allPeopleFormatted"
              :pagination="displayPagination.allPeople"
              :loading="tableLoading.allPeople"
              row-clickable
              @page-change="handleAllPeoplePage"
              @row-click="handleAllPeopleRowClick"
            />
          </ReportPanel>
        </div>
      </div>

      <!-- 🟢 NOVO — espaçador temporário usado por scrollToTarget para
           garantir espaço de rolagem suficiente em abas com pouco
           conteúdo (ex: "Pessoas"). Fica com altura 0 na maior parte do
           tempo; só cresce durante um scroll automático via âncora. -->
      <div :style="{ height: scrollSpacerHeight + 'px' }" aria-hidden="true" />
    </template>

    <RevisionsModal
      v-if="isRevisionsModalOpen"
      :person="selectedPerson"
      :highlight-vehicle-id="highlightVehicleId"
      :highlight-revision-id="highlightRevisionId"
      @close="closeRevisionsModal"
      @register-vehicle="closeRevisionsModal"
    />

    <PersonFormModal
      v-if="isPersonModalOpen"
      :person="editingPerson"
      :is-submitting="isSubmittingPerson"
      @close="closePersonModal"
      @submit="handlePersonSubmit"
    />

    <VehicleFormModal
      v-if="isVehicleModalOpen"
      :person="personForVehicle"
      :highlight-vehicle-id="highlightVehicleIdForModal"
      @close="closeVehicleModal"
    />
  </AppShell>
</template>