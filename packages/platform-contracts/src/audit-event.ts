/**
 * @nzila/platform-contracts — Audit Event Contracts (Platform Layer)
 *
 * Extends the existing @nzila/audit schema with platform-specific
 * event metadata shapes for cross-app audit trail interoperability.
 */
import { z } from 'zod'

// ── Platform Audit Event ────────────────────────────────────────────────────

export const platformAuditEventSchema = z.object({
  /** Audit entry ID. */
  id: z.string().uuid(),
  /** ISO-8601 timestamp. */
  timestamp: z.string().datetime(),
  /** Actor who performed the action. */
  actorId: z.string().min(1),
  /** Org scope. */
  orgId: z.string().min(1),
  /** Module that produced the event. */
  moduleId: z.string().min(1),
  /** Action performed (e.g. "claim.created", "role.assigned"). */
  action: z.string().min(1),
  /** Resource type affected. */
  resource: z.string().min(1),
  /** Resource ID affected. */
  resourceId: z.string().optional(),
  /** Event payload (safe, no PII). */
  payload: z.record(z.unknown()),
  /** Request correlation ID. */
  correlationId: z.string().optional(),
  /** Severity level. */
  severity: z.enum(['info', 'warning', 'critical']).default('info'),
  /** Whether this event is evidence-grade (hash-chained). */
  evidenceGrade: z.boolean().default(false),
})

export type PlatformAuditEvent = z.infer<typeof platformAuditEventSchema>

// ── Audit Event Input (for emitting) ────────────────────────────────────────

export const platformAuditInputSchema = platformAuditEventSchema.omit({
  id: true,
  timestamp: true,
})

export type PlatformAuditInput = z.infer<typeof platformAuditInputSchema>
