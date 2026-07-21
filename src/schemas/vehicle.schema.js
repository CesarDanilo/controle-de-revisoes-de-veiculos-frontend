import { z } from 'zod'

const CURRENT_YEAR = new Date().getFullYear()
const MIN_YEAR = 1950 // piso razoável; ajuste se precisar aceitar carros mais antigos/clássicos

export const carColors = [
  'Branco',
  'Preto',
  'Prata',
  'Cinza',
  'Vermelho',
  'Azul',
  'Verde',
  'Amarelo',
  'Marrom',
  'Bege',
  'Laranja',
  'Dourado',
]

// Aceita com ou sem traço/espaço, e normaliza para maiúsculas sem separador
const normalizePlate = (value) =>
  value
    .toUpperCase()
    .replace(/[\s-]/g, '')

const PLATE_REGEX_OLD = /^[A-Z]{3}[0-9]{4}$/
const PLATE_REGEX_MERCOSUL = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/

export const vehicleSchema = z.object({
  brand_id: z.string().trim().min(1, 'Selecione uma marca.'),

  model: z
    .string()
    .trim()
    .min(1, 'Informe o modelo do veículo.')
    .min(2, 'O modelo deve ter pelo menos 2 caracteres.')
    .max(40, 'O modelo deve ter no máximo 40 caracteres.'),

  year: z
    .string()
    .trim()
    .min(1, 'Informe o ano.')
    .regex(/^\d{4}$/, 'Ano inválido.')
    .refine((val) => Number(val) >= MIN_YEAR, { message: `O ano não pode ser anterior a ${MIN_YEAR}.` })
    .refine((val) => Number(val) <= CURRENT_YEAR + 1, { message: `O ano não pode ser maior que ${CURRENT_YEAR + 1}.` }),

  color: z
    .string()
    .trim()
    .min(1, 'Selecione a cor.')
    .refine((val) => carColors.includes(val), { message: 'Selecione uma cor válida.' }),

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