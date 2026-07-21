export function maskPhone(rawValue) {
    const d = (rawValue ?? '').replace(/\D/g, '').slice(0, 11)
    const ddd = d.slice(0, 2)
    const rest = d.slice(2)
  
    if (d.length === 0) return ''
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

export function createLengthGuard(getValue, maxLength) {
  return function (e) {
    const controlKeys = [
      'Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight',
      'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter',
    ]
    if (controlKeys.includes(e.key)) return
    if (e.ctrlKey || e.metaKey) return

    // ignora teclas de tamanho > 1 que não sejam impressão de caractere (ex: Shift, CapsLock, F1...)
    if (e.key.length > 1) return

    const target = e.target
    const hasSelection = target.selectionStart !== target.selectionEnd
    if (hasSelection) return

    if (getValue().length >= maxLength) {
      e.preventDefault()
    }
  }
}

const blockNameOverflow = createLengthGuard(() => form.name, 100)