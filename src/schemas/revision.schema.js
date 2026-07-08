import { z } from 'zod'

export const revisionSchema = z.object({
  vehicle_id: z.string().min(1),
  description: z.string().max(255).optional(),
  revision_date: z.string().min(1, 'Informe a data da revisão.'),
  km: z.string().optional(),
  cost: z.string().optional(),
  next_revision_date: z.string().optional(),
  next_revision_km: z.string().optional(),
})