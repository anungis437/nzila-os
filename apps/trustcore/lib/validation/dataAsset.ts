/**
 * TrustCore — Data Asset Validation Schema
 * Zod schema for POST /api/data-inventory request bodies.
 */
import { z } from 'zod'

export const createDataAssetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(2000).optional(),
  dataCategory: z.enum([
    'identity',
    'contact',
    'financial',
    'health',
    'employment',
    'children',
    'sensitive',
    'other',
  ]),
  sensitivityLevel: z.enum(['low', 'medium', 'high', 'critical']),
  processingPurpose: z.string().max(1000).optional(),
  lawfulBasisOrConsentBasis: z.string().max(500).optional(),
  storageLocation: z.string().max(500).optional(),
  systemOwner: z.string().max(255).optional(),
  retentionPeriod: z.string().max(255).optional(),
  crossBorderTransfer: z.boolean().default(false),
  destinationCountry: z.string().max(100).optional(),
  vendorId: z.string().uuid().optional(),
})

export type CreateDataAssetInput = z.infer<typeof createDataAssetSchema>
