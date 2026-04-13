import { z } from 'zod'

/**
 * Base schema shared by all canonical entities in Nzila OS.
 * Every cross-app entity must extend this base.
 */
export const canonicalEntityBaseSchema = z.object({
  id: z.string().uuid(),
  entityType: z.string().min(1),
  orgId: z.string().min(1),
  sourceModule: z.string().min(1),
  displayName: z.string().optional(),
  status: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string().min(1),
  updatedBy: z.string().optional(),
  schemaVersion: z.string().default('1.0.0'),
  extensions: z.record(z.unknown()).optional(),
})

export type CanonicalEntityBase = z.infer<typeof canonicalEntityBaseSchema>
