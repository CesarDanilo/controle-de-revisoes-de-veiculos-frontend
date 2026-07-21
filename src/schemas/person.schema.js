import { z } from 'zod'
import { parse as parseDomain } from 'tldts'

const emailFormatRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,24}$/

const MAX_AGE = 130

function calculateAge(birthDate) {
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }

  return age
}

export const personSchema = z.object({
  name: z
    .string()
    .min(1, 'Informe o nome.')
    .min(3, 'O nome deve ter pelo menos 3 caracteres.'),

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

  document: z
    .string()
    .min(1, 'Informe o CPF.')
    .min(11, 'CPF inválido.'),

    birth_date: z
    .string()
    .min(1, 'Informe a data de nascimento.')
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Data de nascimento inválida.',
    })
    .refine((val) => new Date(val) <= new Date(), {
      message: 'A data de nascimento não pode ser no futuro.',
    })
    .superRefine((val, ctx) => {
      const age = calculateAge(new Date(val))
      if (age > MAX_AGE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Essa data indica ${age} anos. Confirme se está correta.`,
        })
      }
    }),

  gender: z
    .enum(['M', 'F', 'O'], {
      errorMap: () => ({ message: 'Selecione um gênero.' }),
    }),
})