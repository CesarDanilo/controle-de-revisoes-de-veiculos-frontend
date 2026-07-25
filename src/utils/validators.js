// utils/validators.js

/**
 * Valida CPF usando o algoritmo oficial de dígitos verificadores (mod-11).
 */
export function isValidCPF(cpf) {
  const cleaned = cpf.replace(/\D/g, '')

  if (cleaned.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cleaned)) return false // sequências tipo 111.111.111-11

  const calcDigit = (base) => {
    let sum = 0
    let weight = base.length + 1

    for (const digit of base) {
      sum += parseInt(digit, 10) * weight
      weight--
    }

    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }

  const digits = cleaned.slice(0, 9)
  const firstCheck = calcDigit(digits)
  const secondCheck = calcDigit(digits + firstCheck)

  return cleaned === digits + firstCheck.toString() + secondCheck.toString()
}

/**
 * Valida CNPJ usando o algoritmo oficial de dígitos verificadores (mod-11,
 * com pesos específicos diferentes do CPF).
 */
export function isValidCNPJ(cnpj) {
  const cleaned = cnpj.replace(/\D/g, '')

  if (cleaned.length !== 14) return false
  if (/^(\d)\1{13}$/.test(cleaned)) return false // sequências repetidas

  const calcDigit = (base, weights) => {
    let sum = 0
    for (let i = 0; i < base.length; i++) {
      sum += parseInt(base[i], 10) * weights[i]
    }
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }

  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const secondWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  const base = cleaned.slice(0, 12)
  const firstCheck = calcDigit(base, firstWeights)
  const secondCheck = calcDigit(base + firstCheck, secondWeights)

  return cleaned === base + firstCheck.toString() + secondCheck.toString()
}

/**
 * Valida CPF (11 dígitos) ou CNPJ (14 dígitos) automaticamente,
 * detectando o tipo pelo tamanho do valor limpo.
 */
export function isValidDocument(value) {
  const cleaned = value.replace(/\D/g, '')

  if (cleaned.length === 11) return isValidCPF(cleaned)
  if (cleaned.length === 14) return isValidCNPJ(cleaned)

  return false
}