/**
 * TrustCore — DSR Request Validation Schema
 * Zod schema for POST /api/requests request bodies.
 */
import { z } from 'zod'

export const createDsrRequestSchema = z.object({
  requesterName: z.string().min(1, 'Requester name is required').max(255),
  requesterEmail: z.string().email('Invalid email address'),
  requestType: z.enum([
    'access',
    'rectification',
    'deletion',
    'portability',
    'consent_withdrawal',
    'other',
  ]),
  identityVerified: z.boolean().default(false),
})

export type CreateDsrRequestInput = z.infer<typeof createDsrRequestSchema>
