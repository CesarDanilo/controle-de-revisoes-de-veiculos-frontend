import { z } from 'zod'

export const vehicleSchema = z.object({
  model: z.string().min(1, 'Informe o modelo.').max(255),
  year: z
    .string()
    .min(1, 'Informe o ano.')
    .refine((val) => {
      const year = Number(val)
      return year >= 1900 && year <= new Date().getFullYear() + 1
    }, 'Ano inválido.'),
  color: z.string().min(1, 'Informe a cor.').max(255),
  brand_id: z.string().min(1, 'Selecione a marca.'),
  license_plate: z
    .string()
    .min(1, 'Informe a placa.')
    .max(10, 'Placa inválida.'),
  people_id: z.string().min(1),
})