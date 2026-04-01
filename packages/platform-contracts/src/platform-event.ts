/**
 * @nzila/platform-contracts — Platform Event Contracts
 *
 * Canonical event schemas for platform-level actions.
 * These are distinct from domain events (in @nzila/contracts) —
 * they cover cross-cutting platform operations.
 */
import { z } from 'zod'

// ── Platform Event Types ────────────────────────────────────────────────────

export const platformEventTypeValues = [
  'org_scope.selected',
  'org_scope.created',
  'org_scope.suspended',
  'org_scope.reactivated',
  'app.launched',
  'module.enabled',
  'module.disabled',
  'role.assigned',
  'role.revoked',
  'audit.event_emitted',
  'notification.created',
  'notification.read',
  'entitlement.changed',
  'user.invited',
  'user.removed',
  'session.started',
  'session.ended',
] as const

export type PlatformEventType = (typeof platformEventTypeValues)[number]

// ── Platform Event Envelope ─────────────────────────────────────────────────

export const platformEventSchema = z.object({
  /** Unique event ID. */
  id: z.string().uuid(),
  /** Event type. */
  type: z.enum(platformEventTypeValues),
  /** ISO-8601 timestamp. */
  timestamp: z.string().datetime(),
  /** Actor who triggered the event. */
  actorId: z.string().min(1),
  /** Org scope where the event occurred. */
  orgId: z.string().optional(),
  /** Module that produced the event. */
  moduleId: z.string().optional(),
  /** Request correlation ID. */
  correlationId: z.string().optional(),
  /** Event-specific payload. */
  payload: z.record(z.unknown()),
  /** Event schema version. */
  version: z.number().int().positive().default(1),
})

export type PlatformEvent = z.infer<typeof platformEventSchema>

// ── Specific Event Payloads ─────────────────────────────────────────────────

export const orgScopeSelectedPayloadSchema = z.object({
  orgId: z.string().min(1),
  orgName: z.string().min(1),
  previousOrgId: z.string().optional(),
})

export const appLaunchedPayloadSchema = z.object({
  appId: z.string().min(1),
  appName: z.string().min(1),
  targetUrl: z.string().optional(),
})

export const moduleEnabledPayloadSchema = z.object({
  moduleId: z.string().min(1),
  orgId: z.string().min(1),
  enabledBy: z.string().min(1),
})

export const roleAssignedPayloadSchema = z.object({
  userId: z.string().min(1),
  orgId: z.string().min(1),
  role: z.string().min(1),
  assignedBy: z.string().min(1),
})

export const entitlementChangedPayloadSchema = z.object({
  orgId: z.string().min(1),
  plan: z.string().min(1),
  previousPlan: z.string().optional(),
  modules: z.array(z.string()),
})
