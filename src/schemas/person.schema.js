import { z } from 'zod'
import { parse as parseDomain } from 'tldts'
import { isValidDocument } from '../utils/validators'

const emailFormatRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,24}$/

export const personSchema = z.object({
  name: z
    .string()
    .min(1, 'Informe o nome.')
    .min(3, 'O nome deve ter pelo menos 3 caracteres.')
    .max(100, 'O nome deve ter no máximo 100 caracteres.'),

  email: z
    .string()
    .min(1, 'Informe o e-mail.')
    .max(254, 'E-mail muito longo.')
    .regex(emailFormatRegex, 'Digite um e-mail válido.')
    .refine((val) => {
      const domain = val.split('@')[1] ?? ''
      const parsed = parseDomain(domain)
      return parsed.isIcann === true && !!parsed.publicSuffix
    }, 'Digite um e-mail válido.'),

  phone: z
    .string()
    .min(1, 'Informe o telefone.')
    .transform((val) => val.replace(/\D/g, ''))
    .refine((val) => val.length === 10 || val.length === 11, {
      message: 'Telefone inválido. Informe DDD + número (10 ou 11 dígitos).',
    }),

  // 🔴 AQUI — aceita CPF (11) ou CNPJ (14), validando o dígito verificador certo
  document: z
    .string()
    .min(1, 'Informe o documento.')
    .transform((val) => val.replace(/\D/g, ''))
    .refine((val) => val.length === 11 || val.length === 14, {
      message: 'Documento deve ter 11 dígitos (CPF) ou 14 dígitos (CNPJ).',
    })
    .refine((val) => isValidDocument(val), {
      message: 'Documento inválido. Confira os números digitados.',
    }),

  gender: z
    .enum(['M', 'F', 'O'], {
      error: () => ({ message: 'Selecione um gênero.' }),
    }),
})