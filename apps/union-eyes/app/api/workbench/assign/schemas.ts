import { z } from 'zod'

export const assignSchema = z.object({
  claimId: z.guid(),
  assignTo: z.string().optional(),
})
