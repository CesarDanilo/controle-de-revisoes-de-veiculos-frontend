import { z } from 'zod'

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Informe seu e-mail.')
    .email('Digite um e-mail válido.'),
  password: z
    .string()
    .min(1, 'Informe sua senha.'),
})

export const registerSchema = z.object({
  name: z
    .string()
    .min(1, 'Informe seu nome.')
    .min(3, 'O nome deve ter pelo menos 3 caracteres.'),
  email: z
    .string()
    .min(1, 'Informe seu e-mail.')
    .email('Digite um e-mail válido.'),
  password: z
    .string()
    .min(1, 'Informe sua senha.')
    .min(8, 'A senha deve ter pelo menos 8 caracteres.')
    .regex(/[A-Z]/, 'A senha deve ter ao menos uma letra maiúscula.')
    .regex(/[0-9]/, 'A senha deve ter ao menos um número.'),
})