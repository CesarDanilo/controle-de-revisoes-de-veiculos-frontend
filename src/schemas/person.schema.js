import { z } from 'zod'
import { parse as parseDomain } from 'tldts'
import { isValidDocument } from '../utils/validators'

const emailFormatRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,24}$/
const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/

// limite máximo de idade aceito, usado só pra pegar erro de digitação grosseiro
const MAX_AGE_YEARS = 120

// Extraído para uso isolado (ex: validação de blur antes do submit),
// já que .superRefine() abaixo transforma o objeto em ZodEffects
// e remove o acesso via personSchema.shape.email
export const emailSchema = z
  .string()
  .min(1, 'Informe o e-mail.')
  .max(254, 'E-mail muito longo.')
  .regex(emailFormatRegex, 'Digite um e-mail válido.')
  .refine((val) => {
    const domain = val.split('@')[1] ?? ''
    const parsed = parseDomain(domain)
    return parsed.isIcann === true && !!parsed.publicSuffix
  }, 'Digite um e-mail válido.')

export const personSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Informe o nome.')
      .min(3, 'O nome deve ter pelo menos 3 caracteres.')
      .max(100, 'O nome deve ter no máximo 100 caracteres.'),

    email: emailSchema,

    phone: z
      .string()
      .min(1, 'Informe o telefone.')
      .transform((val) => val.replace(/\D/g, ''))
      .refine((val) => val.length === 10 || val.length === 11, {
        message: 'Telefone inválido. Informe DDD + número (10 ou 11 dígitos).',
      }),

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
      .enum(['M', 'F', 'O'])
      .optional()
      .nullable(),

    birth_date: z
      .string()
      .optional()
      .nullable(),
  })
  .superRefine((data, ctx) => {
    const isPessoaFisica = data.document.length === 11

    if (!isPessoaFisica) return

    if (!data.gender) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gender'],
        message: 'Selecione um gênero.',
      })
    }

    if (!data.birth_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['birth_date'],
        message: 'Informe a data de nascimento.',
      })
      return
    }

    if (!isoDateRegex.test(data.birth_date)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['birth_date'],
        message: 'Informe uma data de nascimento válida.',
      })
      return
    }

    const birth = new Date(`${data.birth_date}T00:00:00`)
    const today = new Date()

    if (Number.isNaN(birth.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['birth_date'],
        message: 'Informe uma data de nascimento válida.',
      })
      return
    }

    if (birth > today) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['birth_date'],
        message: 'A data de nascimento não pode ser no futuro.',
      })
      return
    }

    const maxAgeDate = new Date(today)
    maxAgeDate.setFullYear(maxAgeDate.getFullYear() - MAX_AGE_YEARS)

    if (birth < maxAgeDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['birth_date'],
        message: 'Data de nascimento inválida.',
      })
    }
  })