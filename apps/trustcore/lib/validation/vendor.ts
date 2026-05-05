/**
 * TrustCore — Vendor Validation Schema
 * Zod schema for POST /api/vendors request bodies.
 */
import { z } from 'zod'

export const createVendorSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  serviceDescription: z.string().max(2000).optional(),
  country: z.string().max(100).optional(),
  dataSharedDescription: z.string().max(2000).optional(),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  crossBorderTransfer: z.boolean().default(false),
  piaRequired: z.boolean().default(false),
  contractReviewed: z.boolean().default(false),
})

export type CreateVendorInput = z.infer<typeof createVendorSchema>
