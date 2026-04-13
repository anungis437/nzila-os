import { z } from 'zod'

/**
 * Canonical audit record schema — cross-app audit trail contracts.
 */

export const AUDIT_SEVERITY_VALUES = ['info', 'warning', 'critical'] as const
export type AuditSeverity = (typeof AUDIT_SEVERITY_VALUES)[number]

export const auditInputSchema = z.object({
  actorId: z.string().min(1),
  orgId: z.string().min(1),
  moduleId: z.string().min(1),
  action: z.string().min(1),
  resource: z.string().min(1),
  resourceId: z.string().optional(),
  payload: z.record(z.unknown()).default({}),
  correlationId: z.string().optional(),
  severity: z.enum(AUDIT_SEVERITY_VALUES).default('info'),
  evidenceGrade: z.boolean().default(false),
})
export type AuditInput = z.infer<typeof auditInputSchema>

export const canonicalAuditRecordSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  action: z.string().min(1),
  actorId: z.string().min(1),
  orgId: z.string().min(1),
  sourceModule: z.string().min(1),
  resourceType: z.string().min(1),
  resourceId: z.string().optional(),
  before: z.record(z.unknown()).optional(),
  after: z.record(z.unknown()).optional(),
  severity: z.enum(AUDIT_SEVERITY_VALUES),
  evidenceGrade: z.boolean().default(false),
  hash: z.string().optional(),
  previousHash: z.string().optional(),
  correlationId: z.string().optional(),
  schemaVersion: z.string().default('1.0.0'),
})
export type CanonicalAuditRecord = z.infer<typeof canonicalAuditRecordSchema>
