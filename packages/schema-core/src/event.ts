import { z } from 'zod'

/**
 * Canonical event schema — cross-app event contracts.
 */

export const eventMetadataSchema = z.object({
  correlationId: z.string().optional(),
  causationId: z.string().optional(),
  traceId: z.string().optional(),
  sourceModule: z.string().min(1),
  schemaVersion: z.string().default('1.0.0'),
})
export type EventMetadata = z.infer<typeof eventMetadataSchema>

export const canonicalEventSchema = z.object({
  id: z.string().uuid(),
  eventType: z.string().min(1),
  eventVersion: z.number().int().positive().default(1),
  sourceModule: z.string().min(1),
  orgId: z.string().min(1),
  actorId: z.string().min(1),
  timestamp: z.string().datetime(),
  entityId: z.string().uuid().optional(),
  entityType: z.string().optional(),
  correlationId: z.string().optional(),
  causationId: z.string().optional(),
  payload: z.record(z.unknown()),
  schemaVersion: z.string().default('1.0.0'),
})
export type CanonicalEvent = z.infer<typeof canonicalEventSchema>
