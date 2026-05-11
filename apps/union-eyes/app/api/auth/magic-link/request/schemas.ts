import { z } from 'zod'

export const magicLinkRequestBodySchema = z.object({
  email: z.string().email(),
  organizationId: z.string().uuid().optional(),
})
