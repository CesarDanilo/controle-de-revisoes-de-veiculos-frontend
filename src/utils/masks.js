const SPECIAL_PHONE_PREFIXES = ['0800', '0300', '0400', '0500', '0900']

export function maskPhone(rawValue) {
  const d = (rawValue ?? '').replace(/\D/g, '').slice(0, 11)

  if (d.length === 0) return ''

  // Números especiais: 0800 067 6010 (4-3-4, sempre 11 dígitos)
  const prefix4 = d.slice(0, 4)
  if (SPECIAL_PHONE_PREFIXES.includes(prefix4)) {
    const rest = d.slice(4)
    if (rest.length === 0) return prefix4
    if (rest.length <= 3) return `${prefix4} ${rest}`
    return `${prefix4} ${rest.slice(0, 3)} ${rest.slice(3, 7)}`
  }

  const ddd = d.slice(0, 2)
  const rest = d.slice(2)

  if (d.length <= 2) return `(${ddd}`
  if (rest.length <= 4) return `(${ddd}) ${rest}`
  if (d.length <= 10) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`
}
  
export function maskCPF(rawValue) {
  const d = (rawValue ?? '').replace(/\D/g, '').slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

// 🔴 AQUI — máscara de CNPJ, mesmo padrão progressivo do maskCPF
export function maskCNPJ(rawValue) {
  const d = (rawValue ?? '').replace(/\D/g, '').slice(0, 14)
  if (d.length === 0) return ''
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

// 🔴 AQUI — detecta CPF ou CNPJ pelo tamanho e aplica a máscara certa
// (usado na listagem, onde não sabemos manualmente qual tipo cada pessoa tem)
export function maskDocument(rawValue) {
  const d = (rawValue ?? '').replace(/\D/g, '')
  return d.length > 11 ? maskCNPJ(d) : maskCPF(d)
}

// bloqueia digitação de qualquer coisa que não seja número
// (mantém teclas de controle: backspace, delete, tab, setas, etc.)
export function blockNonNumericKey(e) {
  const controlKeys = [
    'Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight',
    'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter',
  ]
  if (controlKeys.includes(e.key)) return
  if (e.ctrlKey || e.metaKey) return

  if (!/^\d$/.test(e.key)) {
    e.preventDefault()
  }
}