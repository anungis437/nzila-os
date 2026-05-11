import { z } from 'zod'

export const assignSchema = z.object({
  claimId: z.string().uuid(),
  assignTo: z.string().optional(),
})
