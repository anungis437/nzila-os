import { z } from 'zod'

/**
 * Document / file metadata schemas — canonical document contracts.
 */

export const DOCUMENT_ACCESS_LEVELS = ['private', 'org', 'public'] as const
export type DocumentAccessLevel = (typeof DOCUMENT_ACCESS_LEVELS)[number]

export const documentMetadataSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  storagePath: z.string().min(1),
  uploadedAt: z.string().datetime(),
  uploadedBy: z.string().min(1),
  moduleId: z.string().optional(),
  category: z.string().optional(),
  contentHash: z.string().optional(),
  accessLevel: z.enum(DOCUMENT_ACCESS_LEVELS).default('org'),
  metadata: z.record(z.unknown()).optional(),
})
export type DocumentMetadata = z.infer<typeof documentMetadataSchema>

export const documentChainOfCustodySchema = z.object({
  documentId: z.string().uuid(),
  entries: z.array(z.object({
    action: z.string().min(1),
    actorId: z.string().min(1),
    timestamp: z.string().datetime(),
    fromState: z.string().optional(),
    toState: z.string().optional(),
    reason: z.string().optional(),
  })),
  currentCustodian: z.string().min(1),
  lastUpdated: z.string().datetime(),
})
export type DocumentChainOfCustody = z.infer<typeof documentChainOfCustodySchema>
