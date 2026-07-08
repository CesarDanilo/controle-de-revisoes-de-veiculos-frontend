import { z } from 'zod'

export const personSchema = z.object({
  name: z
    .string()
    .min(1, 'Informe o nome.')
    .min(3, 'O nome deve ter pelo menos 3 caracteres.'),
  email: z
    .string()
    .min(1, 'Informe o e-mail.')
    .email('Digite um e-mail válido.'),
  phone: z
    .string()
    .min(1, 'Informe o telefone.')
    .min(10, 'Telefone inválido.'),
  document: z
    .string()
    .min(1, 'Informe o CPF.')
    .min(11, 'CPF inválido.'),
  birth_date: z
    .string()
    .min(1, 'Informe a data de nascimento.'),
  gender: z
    .enum(['M', 'F', 'O'], {
      errorMap: () => ({ message: 'Selecione um gênero.' }),
    }),
})