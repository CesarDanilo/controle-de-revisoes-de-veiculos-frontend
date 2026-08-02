import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import JSZip from 'jszip'

// ---------------------------------------------------------------------
// IDENTIDADE VISUAL DO PDF
// ---------------------------------------------------------------------
// 🔴 AQUI — ajuste pra bater com sua marca. BRAND_COLOR é a cor sólida
// (cabeçalho, cabeçalho de tabela); BRAND_COLOR_SOFT é a mesma cor só que
// mais clara, usada no zebra striping das linhas.
const BRAND_COLOR = [37, 99, 235] // brand-600
const BRAND_COLOR_SOFT = [239, 246, 255] // brand-50 (linhas alternadas)
const TEXT_DARK = [30, 41, 59] // slate-800
const TEXT_MUTED = [100, 116, 139] // slate-500
const BORDER_LIGHT = [226, 232, 240] // slate-200

const APP_NAME = 'Controle de revisões'

const PAGE_MARGIN = 14
const HEADER_HEIGHT = 30

// ---------------------------------------------------------------------
// 🟢 NOVO — FRAGMENTAÇÃO POR TAMANHO DE ARQUIVO
// ---------------------------------------------------------------------
// 🔴 AQUI — limite padrão por arquivo, em MB. Pode ser sobrescrito por
// chamada passando `maxSizeMB` em exportTable/exportMultiTable/exportFullReport.
// 4MB é um valor confortável pra anexar em e-mail e pra upload na maioria
// dos sistemas; ajuste conforme a necessidade do seu caso de uso.
const DEFAULT_MAX_FILE_SIZE_MB = 4

// Mira 85% do limite real na calibração inicial — dá folga pra linhas que
// acabam sendo mais "pesadas" (textos mais longos) do que a amostra usada
// pra calcular a média de bytes por linha.
const CALIBRATION_SAFETY_MARGIN = 0.85

const todayLabel = () => new Date().toLocaleDateString('pt-BR')

const nowLabel = () =>
  new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

const isoDateForFilename = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// usado pra transformar título de seção/tabela em nome de arquivo seguro
// (ex: "Tempo médio entre revisões" -> "tempo-medio-entre-revisoes")
const slugify = (text) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

// ---------------------------------------------------------------------
// 🟢 NOVO — FÁBRICA CENTRAL DE INSTÂNCIAS jsPDF
// ---------------------------------------------------------------------
// `compress: true` ativa a compressão interna do jsPDF (streams flate),
// reduzindo um pouco o peso final do PDF sem alterar nada visualmente.
// Como o conteúdo aqui é só texto/vetor (autoTable), o ganho tende a ser
// modesto (uns %), mas é "de graça" — por isso fica sempre ligado.
// Toda instância de jsPDF no arquivo passa a ser criada por aqui, em vez
// de `new jsPDF('p', 'mm', 'a4')` direto.
const createPdf = () => new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true })

// ---------------------------------------------------------------------
// CABEÇALHO — faixa colorida cheia no topo da página, título em branco
// ---------------------------------------------------------------------
const addHeader = (pdf, title, subtitle) => {
  const pageWidth = pdf.internal.pageSize.getWidth()

  // faixa de fundo
  pdf.setFillColor(...BRAND_COLOR)
  pdf.rect(0, 0, pageWidth, HEADER_HEIGHT, 'F')

  // nome do sistema, discreto, no canto superior direito da faixa
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(255, 255, 255)
  pdf.text(APP_NAME, pageWidth - PAGE_MARGIN, 9, { align: 'right' })

  // título
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  pdf.text(title, PAGE_MARGIN, 18)

  // subtítulo (contagem de registros, período, etc.)
  if (subtitle) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9.5)
    pdf.setTextColor(219, 234, 254) // brand-100, texto secundário sobre fundo colorido
    pdf.text(subtitle, PAGE_MARGIN, 25)
  }

  pdf.setTextColor(...TEXT_DARK)
}

// ---------------------------------------------------------------------
// RODAPÉ — aplicado em TODAS as páginas do documento no final, já que
// tabelas longas (autoTable) podem gerar páginas extras sozinhas sem
// passar de novo pela addHeader
// ---------------------------------------------------------------------
const finalizeDocument = (pdf) => {
  const pageCount = pdf.internal.getNumberOfPages()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const footerY = pageHeight - 10

  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i)

    pdf.setDrawColor(...BORDER_LIGHT)
    pdf.setLineWidth(0.2)
    pdf.line(PAGE_MARGIN, footerY - 5, pageWidth - PAGE_MARGIN, footerY - 5)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(...TEXT_MUTED)
    pdf.text(`Gerado em ${nowLabel()}`, PAGE_MARGIN, footerY)
    pdf.text(`Página ${i} de ${pageCount}`, pageWidth - PAGE_MARGIN, footerY, { align: 'right' })
  }
}

// ---------------------------------------------------------------------
// ESTILO PADRÃO DAS TABELAS — cabeçalho sólido na cor da marca, zebra
// striping suave, bordas discretas
// ---------------------------------------------------------------------
const TABLE_THEME = {
  theme: 'striped',
  headStyles: {
    fillColor: BRAND_COLOR,
    textColor: [255, 255, 255],
    fontStyle: 'bold',
    fontSize: 9.5,
    halign: 'left',
  },
  alternateRowStyles: { fillColor: BRAND_COLOR_SOFT },
  bodyStyles: {
    fontSize: 9,
    textColor: TEXT_DARK,
    cellPadding: 4,
  },
  styles: {
    lineColor: BORDER_LIGHT,
    lineWidth: 0.1,
  },
  margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
}

const addOverviewContent = (pdf, { kpis, brandsRanking, peopleRanking, genderBreakdown }, startY) => {
  const sectionTitle = (text, y) => {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.setTextColor(...TEXT_DARK)
    pdf.text(text, PAGE_MARGIN, y)
  }

  sectionTitle('Indicadores gerais', startY)
  autoTable(pdf, {
    ...TABLE_THEME,
    startY: startY + 4,
    head: [['Indicador', 'Valor']],
    body: kpis.map((k) => [k.label, k.value]),
    columnStyles: { 1: { fontStyle: 'bold', halign: 'right' } },
  })
  let y = pdf.lastAutoTable.finalY + 12

  sectionTitle('Marcas com mais revisões', y)
  autoTable(pdf, {
    ...TABLE_THEME,
    startY: y + 4,
    head: [['Marca', 'Qtd.']],
    body: brandsRanking.length ? brandsRanking.map((b) => [b.label, b.value]) : [['—', '—']],
    columnStyles: { 1: { halign: 'right' } },
  })
  y = pdf.lastAutoTable.finalY + 12

  sectionTitle('Clientes mais frequentes', y)
  autoTable(pdf, {
    ...TABLE_THEME,
    startY: y + 4,
    head: [['Cliente', 'Qtd.']],
    body: peopleRanking.length ? peopleRanking.map((p) => [p.label, p.value]) : [['—', '—']],
    columnStyles: { 1: { halign: 'right' } },
  })
  y = pdf.lastAutoTable.finalY + 12

  if (genderBreakdown?.length) {
    sectionTitle('Distribuição por gênero', y)
    autoTable(pdf, {
      ...TABLE_THEME,
      startY: y + 4,
      head: [['Grupo', 'Categoria', 'Quantidade']],
      body: genderBreakdown,
      columnStyles: { 2: { halign: 'right' } },
    })
  }
}

const addTableContent = (pdf, { columns, rows }, startY) => {
  autoTable(pdf, {
    ...TABLE_THEME,
    startY,
    head: [columns.map((c) => c.label)],
    body: rows.length ? rows.map((row) => columns.map((c) => row[c.key] ?? '—')) : [columns.map(() => '—')],
  })
}

// ---------------------------------------------------------------------
// 🟢 NOVO — MOTOR DE FRAGMENTAÇÃO POR TAMANHO
// ---------------------------------------------------------------------
// Mede o tamanho real do PDF já montado, em bytes. `output('blob')` é a
// forma correta de saber o tamanho final de verdade (não uma estimativa),
// já que reflete fontes, compressão interna do jsPDF, etc.
const measureBytes = (pdf) => pdf.output('blob').size

const composeSubtitle = (contextLabel, rest) => (contextLabel ? `${contextLabel} · ${rest}` : rest)

// Amostra até 40 linhas reais pra descobrir quantos bytes, em média, cada
// linha da tabela consome — usado só como PALPITE inicial de quantas
// linhas cabem por arquivo. A palavra final sempre é a medição real feita
// em planPartBoundaries.
const calibrateRowsPerPart = ({ title, columns, rows, maxBytes, contextLabel }) => {
  const sampleSize = Math.min(rows.length, 40)
  const sample = rows.slice(0, sampleSize)

  const baseline = createPdf()
  addHeader(baseline, title, composeSubtitle(contextLabel, 'Parte 1 · 0 registro(s)'))
  finalizeDocument(baseline)
  const baselineBytes = measureBytes(baseline)

  const withSample = createPdf()
  addHeader(withSample, title, composeSubtitle(contextLabel, `Parte 1 · ${sample.length} registro(s)`))
  addTableContent(withSample, { columns, rows: sample }, HEADER_HEIGHT + 8)
  finalizeDocument(withSample)
  const withSampleBytes = measureBytes(withSample)

  const bytesPerRow = Math.max(1, (withSampleBytes - baselineBytes) / sampleSize)
  const safeBudget = maxBytes * CALIBRATION_SAFETY_MARGIN - baselineBytes
  return Math.max(1, Math.floor(safeBudget / bytesPerRow))
}

// Decide quantas linhas vão em cada parte, VERIFICANDO o tamanho real de
// cada uma (não só confiando na calibração). Se uma parte estourar o
// limite mesmo assim (linhas mais "pesadas" que a média da amostra), corta
// o chunk pela metade e tenta de novo — na prática isso raramente passa de
// 1-2 tentativas, já que a calibração já mira com folga (85% do limite).
const planPartBoundaries = ({ title, columns, rows, maxBytes, contextLabel }) => {
  const boundaries = []
  let remaining = rows
  let rowsPerPartGuess = calibrateRowsPerPart({ title, columns, rows, maxBytes, contextLabel })

  while (remaining.length) {
    let chunk = remaining.slice(0, Math.min(rowsPerPartGuess, remaining.length))
    let attempts = 0

    while (true) {
      const probe = createPdf()
      addHeader(probe, title, composeSubtitle(contextLabel, `Parte ${boundaries.length + 1} · ${chunk.length} registro(s)`))
      addTableContent(probe, { columns, rows: chunk }, HEADER_HEIGHT + 8)
      finalizeDocument(probe)
      const bytes = measureBytes(probe)
      attempts++

      if (bytes <= maxBytes || chunk.length <= 1 || attempts > 8) break
      chunk = chunk.slice(0, Math.max(1, Math.floor(chunk.length / 2)))
    }

    boundaries.push(chunk.length)
    remaining = remaining.slice(chunk.length)
    rowsPerPartGuess = chunk.length
  }

  return boundaries
}

// Constrói os arquivos finais de UMA tabela (título + colunas + linhas),
// já fragmentados se necessário. Se tudo cabe em 1 arquivo dentro do
// limite, devolve exatamente 1 arquivo com o nome original — sem sufixo
// de "parte", sem mudança de comportamento em relação ao export anterior.
const buildTablePartsFiles = ({ title, columns, rows, filenamePrefix, maxBytes, contextLabel }) => {
  // Sem registros: 1 arquivo só, com o placeholder "—" que addTableContent já trata
  if (!rows.length) {
    const pdf = createPdf()
    addHeader(pdf, title, composeSubtitle(contextLabel, '0 registro(s)'))
    addTableContent(pdf, { columns, rows }, HEADER_HEIGHT + 8)
    finalizeDocument(pdf)
    return [{ pdf, filename: `${filenamePrefix}-${isoDateForFilename()}.pdf` }]
  }

  const boundaries = planPartBoundaries({ title, columns, rows, maxBytes, contextLabel })
  const totalParts = boundaries.length

  // Coube tudo em 1 arquivo — mantém o nome de arquivo original, sem
  // sufixo de parte, exatamente como antes da fragmentação existir.
  if (totalParts <= 1) {
    const pdf = createPdf()
    addHeader(pdf, title, composeSubtitle(contextLabel, `${rows.length} registro(s)`))
    addTableContent(pdf, { columns, rows }, HEADER_HEIGHT + 8)
    finalizeDocument(pdf)
    return [{ pdf, filename: `${filenamePrefix}-${isoDateForFilename()}.pdf` }]
  }

  // Não coube em 1 arquivo — gera N arquivos, cada um dentro do limite
  let offset = 0
  return boundaries.map((count, idx) => {
    const chunk = rows.slice(offset, offset + count)
    offset += count

    const pdf = createPdf()
    addHeader(
      pdf,
      title,
      composeSubtitle(contextLabel, `Parte ${idx + 1} de ${totalParts} · ${chunk.length} de ${rows.length} registro(s)`)
    )
    addTableContent(pdf, { columns, rows: chunk }, HEADER_HEIGHT + 8)
    finalizeDocument(pdf)

    return {
      pdf,
      filename: `${filenamePrefix}-parte-${idx + 1}-de-${totalParts}-${isoDateForFilename()}.pdf`,
    }
  })
}

// Nome do .zip quando a exportação gera mais de 1 arquivo — usa o prefixo
// do primeiro arquivo (sem o sufixo "-parte-N-de-M-data.pdf") como base.
const buildZipFilename = (files) => {
  const first = files[0].filename
  const base = first.replace(/-parte-\d+-de-\d+-\d{4}-\d{2}-\d{2}\.pdf$/, '') || first.replace(/\.pdf$/, '')
  return `${base}-${isoDateForFilename()}.zip`
}

// 🟢 NOVO — EMPACOTAMENTO EM .ZIP
// ---------------------------------------------------------------------
// Se a exportação gerou só 1 arquivo, baixa o PDF direto (sem zip
// desnecessário — mesmo comportamento de antes). Se gerou mais de 1
// arquivo (fragmentação por tamanho), empacota todos dentro de um único
// .zip e dispara UM download só — resolve o problema de vários downloads
// separados/bloqueio do navegador, e entrega tudo junto pro usuário.
const downloadFiles = async (files) => {
  if (files.length === 1) {
    files[0].pdf.save(files[0].filename)
    return
  }

  const zip = new JSZip()
  files.forEach((file) => {
    // 'arraybuffer' preserva os bytes do PDF exatamente como foram gerados
    zip.file(file.filename, file.pdf.output('arraybuffer'))
  })

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const zipFilename = buildZipFilename(files)

  const url = URL.createObjectURL(zipBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = zipFilename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)

  console.info(`[useReportPdf] Exportação com ${files.length} arquivo(s) empacotada em ${zipFilename}.`)
}

export function useReportPdf() {
  // ---- Visão geral: KPIs + rankings + quebra por gênero (tudo vetorial) ----
  // Nunca fragmenta: o conteúdo (KPIs + rankings) é sempre pequeno.
  const exportOverview = (payload) => {
    const pdf = createPdf()
    addHeader(pdf, 'Relatório — Visão geral', `Consolidado em ${todayLabel()}`)
    addOverviewContent(pdf, payload, HEADER_HEIGHT + 12)
    finalizeDocument(pdf)
    pdf.save(`relatorio-visao-geral-${isoDateForFilename()}.pdf`)
  }

  // ---- Uma tabela só, com TODOS os registros (sem paginação da tela) ----
  // 🔧 CORRIGIDO — agora fragmenta automaticamente em vários arquivos se
  // ultrapassar `maxSizeMB` (padrão: DEFAULT_MAX_FILE_SIZE_MB).
  const exportTable = async ({ title, columns, rows, filenamePrefix, maxSizeMB = DEFAULT_MAX_FILE_SIZE_MB }) => {
    const files = buildTablePartsFiles({
      title,
      columns,
      rows,
      filenamePrefix,
      maxBytes: maxSizeMB * 1024 * 1024,
    })
    await downloadFiles(files)
  }

  // ---- Várias tabelas (ex: "Revisões" = intervalo médio + período) ----
  // 🔧 CORRIGIDO — antes, todas as seções saíam num único PDF com uma
  // página nova por seção — em bases grandes isso virava um arquivo
  // gigante de centenas de páginas. Agora cada seção vira seu próprio
  // arquivo (nomeado pelo título da seção), e cada um é fragmentado por
  // tamanho individualmente se precisar. `subtitle` (ex: o período
  // selecionado) continua aparecendo no cabeçalho de cada arquivo.
  const exportMultiTable = async ({ title, subtitle, sections, filenamePrefix, maxSizeMB = DEFAULT_MAX_FILE_SIZE_MB }) => {
    const maxBytes = maxSizeMB * 1024 * 1024

    const files = sections.flatMap((section) =>
      buildTablePartsFiles({
        title: `${title} — ${section.title}`,
        columns: section.columns,
        rows: section.rows,
        filenamePrefix: `${filenamePrefix}-${slugify(section.title)}`,
        maxBytes,
        contextLabel: subtitle,
      })
    )

    await downloadFiles(files)
  }

  // ---- Relatório completo: visão geral + uma tabela por seção ----
  // 🔧 CORRIGIDO — mesma lógica: em vez de 1 PDF gigante com uma página
  // nova por tabela, agora sai 1 arquivo pra visão geral (sempre pequeno,
  // nunca fragmenta) + 1 arquivo por tabela (fragmentado se necessário).
  // Isso resolve diretamente o problema de "gera muitas páginas": em vez
  // de um único arquivo enorme, o cliente recebe vários arquivos no
  // tamanho certo, com nomes descritivos.
  const exportFullReport = async ({ overview, tables, filenamePrefix = 'relatorio-geral', maxSizeMB = DEFAULT_MAX_FILE_SIZE_MB }) => {
    const maxBytes = maxSizeMB * 1024 * 1024

    const overviewPdf = createPdf()
    addHeader(overviewPdf, 'Relatório geral — Visão geral', `Consolidado em ${todayLabel()}`)
    addOverviewContent(overviewPdf, overview, HEADER_HEIGHT + 12)
    finalizeDocument(overviewPdf)

    const files = [
      { pdf: overviewPdf, filename: `${filenamePrefix}-visao-geral-${isoDateForFilename()}.pdf` },
      ...tables.flatMap((table) =>
        buildTablePartsFiles({
          title: table.title,
          columns: table.columns,
          rows: table.rows,
          filenamePrefix: `${filenamePrefix}-${slugify(table.title)}`,
          maxBytes,
        })
      ),
    ]

    await downloadFiles(files)
  }

  return { exportOverview, exportTable, exportMultiTable, exportFullReport }
}