import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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

export function useReportPdf() {
  // ---- Visão geral: KPIs + rankings + quebra por gênero (tudo vetorial) ----
  const exportOverview = (payload) => {
    const pdf = new jsPDF('p', 'mm', 'a4')
    addHeader(pdf, 'Relatório — Visão geral', `Consolidado em ${todayLabel()}`)
    addOverviewContent(pdf, payload, HEADER_HEIGHT + 12)
    finalizeDocument(pdf)
    pdf.save(`relatorio-visao-geral-${isoDateForFilename()}.pdf`)
  }

  // ---- Uma tabela só, com TODOS os registros (sem paginação) ----
  const exportTable = ({ title, columns, rows, filenamePrefix }) => {
    const pdf = new jsPDF('p', 'mm', 'a4')
    addHeader(pdf, title, `${rows.length} registro(s)`)
    addTableContent(pdf, { columns, rows }, HEADER_HEIGHT + 8)
    finalizeDocument(pdf)
    pdf.save(`${filenamePrefix}-${isoDateForFilename()}.pdf`)
  }

  // ---- Várias tabelas num único PDF (ex: "Revisões" = intervalo médio + período) ----
  const exportMultiTable = ({ title, subtitle, sections, filenamePrefix }) => {
    const pdf = new jsPDF('p', 'mm', 'a4')
    addHeader(pdf, title, subtitle ?? todayLabel())
    let y = HEADER_HEIGHT + 12

    sections.forEach((section, idx) => {
      if (idx > 0) {
        pdf.addPage()
        addHeader(pdf, section.title, `${section.rows.length} registro(s)`)
        y = HEADER_HEIGHT + 8
      } else if (section.title) {
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(11)
        pdf.setTextColor(...TEXT_DARK)
        pdf.text(section.title, PAGE_MARGIN, y)
        y += 5
      }
      addTableContent(pdf, { columns: section.columns, rows: section.rows }, y)
      y = pdf.lastAutoTable.finalY + 12
    })

    finalizeDocument(pdf)
    pdf.save(`${filenamePrefix}-${isoDateForFilename()}.pdf`)
  }

  // ---- Relatório completo: visão geral + uma seção por página pra cada tabela ----
  const exportFullReport = ({ overview, tables }) => {
    const pdf = new jsPDF('p', 'mm', 'a4')

    addHeader(pdf, 'Relatório geral', `Consolidado em ${todayLabel()}`)
    addOverviewContent(pdf, overview, HEADER_HEIGHT + 12)

    for (const table of tables) {
      pdf.addPage()
      addHeader(pdf, table.title, `${table.rows.length} registro(s)`)
      addTableContent(pdf, { columns: table.columns, rows: table.rows }, HEADER_HEIGHT + 8)
    }

    finalizeDocument(pdf)
    pdf.save(`relatorio-geral-${isoDateForFilename()}.pdf`)
  }

  return { exportOverview, exportTable, exportMultiTable, exportFullReport }
}