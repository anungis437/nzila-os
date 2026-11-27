import { z } from 'zod'

export const caseIntakeResponse = z.object({
  success: z.literal(true),
  claimId: z.string().min(1),
})
