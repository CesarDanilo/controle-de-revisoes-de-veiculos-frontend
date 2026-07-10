import { z } from 'zod'

// Aceita com ou sem traço/espaço, e normaliza para maiúsculas sem separador
const normalizePlate = (value) =>
  value
    .toUpperCase()
    .replace(/[\s-]/g, '')

const PLATE_REGEX_OLD = /^[A-Z]{3}[0-9]{4}$/
const PLATE_REGEX_MERCOSUL = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/

export const vehicleSchema = z.object({
  model: z.string().trim().min(1, 'Informe o modelo do veículo.'),
  year: z
    .string()
    .trim()
    .min(1, 'Informe o ano.')
    .regex(/^\d{4}$/, 'Ano inválido.'),
  color: z.string().trim().min(1, 'Informe a cor.'),
  brand_id: z.string().trim().min(1, 'Selecione uma marca.'),
  license_plate: z
    .string()
    .trim()
    .min(1, 'Informe a placa.')
    .transform(normalizePlate)
    .refine(
      (plate) => PLATE_REGEX_OLD.test(plate) || PLATE_REGEX_MERCOSUL.test(plate),
      'Placa inválida. Use o formato ABC1234 ou ABC1D23.'
    ),
  people_id: z.string().trim().min(1),
})