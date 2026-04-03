/**
 * @nzila/contracts — Canonical Platform Schema
 *
 * Defines the universal contracts that all Nzila OS verticals
 * map to for cross-app intelligence, reporting, and analytics.
 *
 * Every schema is Zod-validated, versioned, and extensible.
 * App-specific extensions MUST extend (not replace) canonical fields.
 */
import { z } from 'zod'

// ── Schema Version ──────────────────────────────────────────────────────────

export const CANONICAL_SCHEMA_VERSION = '1.0.0' as const

// ── Canonical Entity ────────────────────────────────────────────────────────

export const canonicalEntitySchema = z.object({
  /** Globally unique entity ID (UUID). */
  id: z.string().uuid(),
  /** Entity type discriminator (e.g. "claim", "order", "event", "member"). */
  entityType: z.string().min(1),
  /** Org scope for tenant boundary. */
  orgId: z.string().min(1),
  /** Source module that owns this entity (e.g. "union-eyes", "flow", "zonga"). */
  sourceModule: z.string().min(1),
  /** Human-readable display label. */
  displayName: z.string().optional(),
  /** Current lifecycle status. */
  status: z.string().min(1),
  /** ISO-8601 creation timestamp. */
  createdAt: z.string().datetime(),
  /** ISO-8601 last modification timestamp. */
  updatedAt: z.string().datetime(),
  /** Actor who created this entity. */
  createdBy: z.string().min(1),
  /** Actor who last modified this entity. */
  updatedBy: z.string().optional(),
  /** Schema version for forward compatibility. */
  schemaVersion: z.string().default(CANONICAL_SCHEMA_VERSION),
  /** Domain-specific extension payload. */
  extensions: z.record(z.unknown()).optional(),
})

export type NzilaCanonicalEntity = z.infer<typeof canonicalEntitySchema>

// ── Canonical Event ─────────────────────────────────────────────────────────

export const canonicalEventSchema = z.object({
  /** Unique event ID (UUID). */
  id: z.string().uuid(),
  /** Event type (e.g. "claim.created", "payment.processed", "ticket.scanned"). */
  eventType: z.string().min(1),
  /** Event version for schema evolution. */
  eventVersion: z.number().int().positive().default(1),
  /** Source module that emitted this event. */
  sourceModule: z.string().min(1),
  /** Org scope. */
  orgId: z.string().min(1),
  /** Actor who triggered the event. */
  actorId: z.string().min(1),
  /** ISO-8601 timestamp of when the event occurred. */
  timestamp: z.string().datetime(),
  /** Target entity ID (the entity this event pertains to). */
  entityId: z.string().uuid().optional(),
  /** Target entity type. */
  entityType: z.string().optional(),
  /** Correlation ID for distributed tracing. */
  correlationId: z.string().optional(),
  /** Causation ID (the event/action that triggered this one). */
  causationId: z.string().optional(),
  /** Event payload (domain-specific). */
  payload: z.record(z.unknown()),
  /** Schema version. */
  schemaVersion: z.string().default(CANONICAL_SCHEMA_VERSION),
})

export type NzilaCanonicalEvent = z.infer<typeof canonicalEventSchema>

// ── Canonical Metric ────────────────────────────────────────────────────────

export const canonicalMetricSchema = z.object({
  /** Metric name (e.g. "request_latency_ms", "error_rate", "revenue_daily"). */
  name: z.string().min(1),
  /** Metric type. */
  type: z.enum(['counter', 'gauge', 'histogram', 'summary']),
  /** Numeric value. */
  value: z.number(),
  /** Unit of measurement (e.g. "ms", "count", "USD", "percent"). */
  unit: z.string().min(1),
  /** Source module. */
  sourceModule: z.string().min(1),
  /** Org scope (optional for platform-wide metrics). */
  orgId: z.string().optional(),
  /** ISO-8601 timestamp. */
  timestamp: z.string().datetime(),
  /** Dimensional labels for grouping/filtering. */
  labels: z.record(z.string()).optional(),
  /** Schema version. */
  schemaVersion: z.string().default(CANONICAL_SCHEMA_VERSION),
})

export type NzilaCanonicalMetric = z.infer<typeof canonicalMetricSchema>

// ── Canonical Audit Record ──────────────────────────────────────────────────

export const canonicalAuditRecordSchema = z.object({
  /** Unique audit record ID (UUID). */
  id: z.string().uuid(),
  /** ISO-8601 timestamp. */
  timestamp: z.string().datetime(),
  /** Action performed (e.g. "claim.approved", "payment.refunded"). */
  action: z.string().min(1),
  /** Actor who performed the action. */
  actorId: z.string().min(1),
  /** Org scope. */
  orgId: z.string().min(1),
  /** Source module. */
  sourceModule: z.string().min(1),
  /** Target resource type. */
  resourceType: z.string().min(1),
  /** Target resource ID. */
  resourceId: z.string().optional(),
  /** Before-state snapshot (for mutations). */
  before: z.record(z.unknown()).optional(),
  /** After-state snapshot (for mutations). */
  after: z.record(z.unknown()).optional(),
  /** Severity classification. */
  severity: z.enum(['info', 'warning', 'critical']),
  /** Whether this record is evidence-grade (hash-chained, tamper-evident). */
  evidenceGrade: z.boolean().default(false),
  /** Cryptographic hash of this record (for evidence chains). */
  hash: z.string().optional(),
  /** Hash of previous record in the chain. */
  previousHash: z.string().optional(),
  /** Correlation ID for distributed tracing. */
  correlationId: z.string().optional(),
  /** Schema version. */
  schemaVersion: z.string().default(CANONICAL_SCHEMA_VERSION),
})

export type NzilaCanonicalAuditRecord = z.infer<typeof canonicalAuditRecordSchema>

// ── Canonical Workflow State ────────────────────────────────────────────────

export const canonicalWorkflowStateSchema = z.object({
  /** Workflow instance ID (UUID). */
  id: z.string().uuid(),
  /** Workflow definition key (e.g. "claim-lifecycle", "order-fulfillment"). */
  workflowKey: z.string().min(1),
  /** Current state in the state machine. */
  currentState: z.string().min(1),
  /** Previous state (null for initial). */
  previousState: z.string().nullable(),
  /** The entity this workflow governs. */
  entityId: z.string().uuid(),
  /** Entity type. */
  entityType: z.string().min(1),
  /** Org scope. */
  orgId: z.string().min(1),
  /** Source module. */
  sourceModule: z.string().min(1),
  /** Actor who triggered the last transition. */
  lastTransitionBy: z.string().min(1),
  /** ISO-8601 timestamp of last transition. */
  lastTransitionAt: z.string().datetime(),
  /** ISO-8601 creation timestamp. */
  createdAt: z.string().datetime(),
  /** Whether the workflow is in a terminal state. */
  isTerminal: z.boolean().default(false),
  /** Transition history summary (count). */
  transitionCount: z.number().int().nonnegative().default(0),
  /** Error state details if applicable. */
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
  }).optional(),
  /** Schema version. */
  schemaVersion: z.string().default(CANONICAL_SCHEMA_VERSION),
})

export type NzilaCanonicalWorkflowState = z.infer<typeof canonicalWorkflowStateSchema>

// ── Canonical Integration Record ────────────────────────────────────────────

export const canonicalIntegrationRecordSchema = z.object({
  /** Record ID (UUID). */
  id: z.string().uuid(),
  /** Integration provider (e.g. "stripe", "xero", "shopify", "zoho"). */
  provider: z.string().min(1),
  /** Direction of data flow. */
  direction: z.enum(['inbound', 'outbound', 'bidirectional']),
  /** Operation type. */
  operation: z.string().min(1),
  /** Status of the integration operation. */
  status: z.enum(['success', 'failed', 'partial', 'pending', 'retrying']),
  /** Org scope. */
  orgId: z.string().min(1),
  /** Source module. */
  sourceModule: z.string().min(1),
  /** External reference ID from the provider. */
  externalId: z.string().optional(),
  /** Number of records affected. */
  recordCount: z.number().int().nonnegative().optional(),
  /** Duration in milliseconds. */
  durationMs: z.number().nonnegative().optional(),
  /** Error details if failed. */
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
  }).optional(),
  /** ISO-8601 timestamp. */
  timestamp: z.string().datetime(),
  /** Correlation ID. */
  correlationId: z.string().optional(),
  /** Schema version. */
  schemaVersion: z.string().default(CANONICAL_SCHEMA_VERSION),
})

export type NzilaCanonicalIntegrationRecord = z.infer<typeof canonicalIntegrationRecordSchema>

// ── Canonical Financial Record ──────────────────────────────────────────────

export const canonicalFinancialRecordSchema = z.object({
  /** Record ID (UUID). */
  id: z.string().uuid(),
  /** Transaction type (e.g. "payment", "refund", "payout", "fee", "adjustment"). */
  transactionType: z.string().min(1),
  /** Amount in minor units (cents). */
  amountMinor: z.number().int(),
  /** ISO-4217 currency code. */
  currency: z.string().length(3),
  /** Org scope. */
  orgId: z.string().min(1),
  /** Source module. */
  sourceModule: z.string().min(1),
  /** Related entity ID (order, invoice, subscription, etc.). */
  entityId: z.string().uuid().optional(),
  /** Related entity type. */
  entityType: z.string().optional(),
  /** Counterparty ID (customer, creator, vendor). */
  counterpartyId: z.string().optional(),
  /** Payment provider used. */
  provider: z.string().optional(),
  /** External transaction reference. */
  externalReference: z.string().optional(),
  /** Status. */
  status: z.enum(['pending', 'completed', 'failed', 'reversed', 'held']),
  /** ISO-8601 timestamp. */
  timestamp: z.string().datetime(),
  /** Fiscal period (e.g. "2026-Q1", "2026-03"). */
  fiscalPeriod: z.string().optional(),
  /** Whether this is evidence-grade for audit trail. */
  evidenceGrade: z.boolean().default(true),
  /** Correlation ID. */
  correlationId: z.string().optional(),
  /** Schema version. */
  schemaVersion: z.string().default(CANONICAL_SCHEMA_VERSION),
})

export type NzilaCanonicalFinancialRecord = z.infer<typeof canonicalFinancialRecordSchema>

// ── Canonical User Context ──────────────────────────────────────────────────

export const canonicalUserContextSchema = z.object({
  /** Clerk user ID. */
  userId: z.string().min(1),
  /** Display name. */
  displayName: z.string().optional(),
  /** Email address. */
  email: z.string().email().optional(),
  /** Current org scope. */
  orgId: z.string().min(1),
  /** Org role in current scope. */
  orgRole: z.string().min(1),
  /** Session ID. */
  sessionId: z.string().optional(),
  /** Platform roles (cross-org). */
  platformRoles: z.array(z.string()).default([]),
  /** Feature flags active for this user. */
  activeFlags: z.array(z.string()).default([]),
  /** Entitlements active for this user. */
  entitlements: z.array(z.string()).default([]),
  /** Schema version. */
  schemaVersion: z.string().default(CANONICAL_SCHEMA_VERSION),
})

export type NzilaCanonicalUserContext = z.infer<typeof canonicalUserContextSchema>

// ── Canonical Org Context ───────────────────────────────────────────────────

export const canonicalOrgContextSchema = z.object({
  /** Organization ID. */
  orgId: z.string().min(1),
  /** Organization name. */
  orgName: z.string().min(1),
  /** Organization slug. */
  orgSlug: z.string().optional(),
  /** Organization status. */
  status: z.enum(['active', 'suspended', 'archived', 'pending']),
  /** Subscription tier. */
  tier: z.enum(['free', 'starter', 'professional', 'enterprise']).optional(),
  /** Enabled modules for this org. */
  enabledModules: z.array(z.string()).default([]),
  /** Jurisdiction / regulatory region. */
  jurisdiction: z.string().optional(),
  /** ISO-8601 creation timestamp. */
  createdAt: z.string().datetime(),
  /** Schema version. */
  schemaVersion: z.string().default(CANONICAL_SCHEMA_VERSION),
})

export type NzilaCanonicalOrgContext = z.infer<typeof canonicalOrgContextSchema>

// ── Mapping Adapters ────────────────────────────────────────────────────────

/**
 * Creates a type-safe mapper from app-specific data to a canonical schema.
 * Use this to build adapters in each app/vertical.
 */
export function createCanonicalMapper<TInput, TCanonical>(
  schema: z.ZodType<TCanonical>,
  mapFn: (input: TInput) => TCanonical,
) {
  return (input: TInput): TCanonical => {
    const mapped = mapFn(input)
    return schema.parse(mapped)
  }
}

/**
 * Safe version that returns validation result without throwing.
 */
export function createSafeCanonicalMapper<TInput, TCanonical>(
  schema: z.ZodType<TCanonical>,
  mapFn: (input: TInput) => TCanonical,
) {
  return (input: TInput): z.SafeParseReturnType<TCanonical, TCanonical> => {
    const mapped = mapFn(input)
    return schema.safeParse(mapped)
  }
}
