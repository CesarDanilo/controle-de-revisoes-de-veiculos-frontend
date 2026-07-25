// utils/apiErrors.js

// 🔴 Mapa de mensagens conhecidas do backend (Laravel) para mensagens amigáveis em PT-BR
const KNOWN_ERROR_MESSAGES = {
  'The email has already been taken.': 'Este email já pertence a outro usuário.',
  'The document has already been taken.': 'Este CPF já está cadastrado para outra pessoa.',
  'The phone has already been taken.': 'Este telefone já está cadastrado para outra pessoa.',
}

/**
 * Traduz uma mensagem de erro vinda da API (Laravel) para uma mensagem
 * amigável em português. Se não encontrar mapeamento, retorna a mensagem
 * de fallback informada.
 */
export function translateApiError(rawMessage, fallback = 'Não foi possível salvar a pessoa.') {
  if (!rawMessage) return fallback

  // match exato
  if (KNOWN_ERROR_MESSAGES[rawMessage]) {
    return KNOWN_ERROR_MESSAGES[rawMessage]
  }

  // match parcial (caso a mensagem venha com prefixo/sufixo diferente)
  const partialMatch = Object.keys(KNOWN_ERROR_MESSAGES).find((key) =>
    rawMessage.toLowerCase().includes(key.toLowerCase().replace('.', ''))
  )

  if (partialMatch) {
    return KNOWN_ERROR_MESSAGES[partialMatch]
  }

  return fallback
}