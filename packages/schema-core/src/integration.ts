import { z } from 'zod'

/**
 * Canonical integration record schema — cross-app integration contracts.
 */

export const INTEGRATION_STATUS_VALUES = ['success', 'failed', 'partial', 'pending', 'retrying'] as const
export type IntegrationStatus = (typeof INTEGRATION_STATUS_VALUES)[number]

export const INTEGRATION_DIRECTION_VALUES = ['inbound', 'outbound', 'bidirectional'] as const
export type IntegrationDirection = (typeof INTEGRATION_DIRECTION_VALUES)[number]

export const integrationRecordSchema = z.object({
  id: z.string().uuid(),
  provider: z.string().min(1),
  direction: z.enum(INTEGRATION_DIRECTION_VALUES),
  operation: z.string().min(1),
  status: z.enum(INTEGRATION_STATUS_VALUES),
  orgId: z.string().min(1),
  sourceModule: z.string().min(1),
  externalId: z.string().optional(),
  recordCount: z.number().int().nonnegative().optional(),
  durationMs: z.number().nonnegative().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
  }).optional(),
  timestamp: z.string().datetime(),
  correlationId: z.string().optional(),
  schemaVersion: z.string().default('1.0.0'),
})
export type IntegrationRecord = z.infer<typeof integrationRecordSchema>
