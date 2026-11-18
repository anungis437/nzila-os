/**
 * Control Plane — Decision Event Recorder (durable, DB-backed).
 *
 * Every authority decision is written to the `decision_events` table, which
 * is append-only (UPDATE/DELETE are blocked by DB triggers). This module
 * has NO module-level mutable state — durability and ordering come from the
 * database, not from process memory.
 *
 * Callers must provide the full policy decision (policyId, policyVersion,
 * decision, reasonCode) so that downstream audit/replay/UI surfaces always
 * have the rationale on hand without re-running the policy engine.
 *
 * The legacy `outcome` field is retained for backward compatibility with the
 * HTTP API; internally it is mapped to the canonical `decision` column.
 */
import 'server-only'

import { createHash } from 'node:crypto'

import { platformDb } from '@nzila/db/platform'
import { decisionEvents, type DecisionEventRow } from '@nzila/db/schema'
import { createLogger } from '@nzila/os-core'
import type { DecisionEventType } from '@nzila/platform-contracts/control-system'
import { and, desc, eq, sql } from 'drizzle-orm'

import { recordAuditEvent } from '@/lib/audit-db'

const logger = createLogger('control-plane:authority:decision')

// ── Types ────────────────────────────────────────────────────────────────────

export type LegacyOutcome = 'allowed' | 'denied' | 'approved_required' | 'executed' | 'recorded'
export type CanonicalDecision = 'allowed' | 'denied' | 'approval_required'

export interface RecordDecisionInput {
  /** Event taxonomy — see DecisionEventType. */
  type: DecisionEventType
  orgId: string
  /** Domain that owns the policy (e.g., 'governance', 'commerce'). */
  domain: string
  actorId: string
  /** Role under which the actor invoked the action. */
  actorRole: string
  /** Action verb (e.g., 'workflow.trigger', 'governance.approve'). */
  action: string
  /** Resource type (e.g., 'workflow', 'governance_action'). */
  resource: string
  resourceId?: string
  /** Canonical machine decision. */
  outcome: LegacyOutcome
  /** Stable machine-readable reason (UPPER_SNAKE). */
  reasonCode: string
  /** Human-readable explanation of the decision. */
  reason?: string
  /** Policy that produced this decision. */
  policyId: string
  policyVersion: string
  workflowId?: string
  caseId?: string
  correlationId?: string
  requestId?: string
  traceId?: string
  /** Context evaluated by the policy. Will be redacted before persist. */
  evaluatedContext?: Record<string, unknown>
  /** Legacy alias for evaluatedContext when callers cannot easily separate. */
  metadata?: Record<string, unknown>
  /** Back-compat — flattened policy IDs list. Ignored when policyId is set. */
  policyIds?: string[]
}

export interface DecisionRecord {
  id: string
  type: DecisionEventType
  orgId: string
  domain: string
  actorId: string | null
  actorRole: string
  action: string
  resource: string
  resourceId: string | null
  outcome: CanonicalDecision
  reasonCode: string
  reason: string | null
  policyId: string
  policyVersion: string
  policyIds: string[]
  workflowId: string | null
  caseId: string | null
  correlationId: string | null
  requestId: string | null
  traceId: string | null
  metadata: Record<string, unknown>
  requestHash: string
  recordedAt: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const REDACTED_KEYS = new Set([
  'password',
  'token',
  'apiKey',
  'api_key',
  'secret',
  'authorization',
  'authToken',
  'auth_token',
  'sessionToken',
  'session_token',
  'cookie',
  'creditCard',
  'credit_card',
  'cardNumber',
  'card_number',
  'cvv',
  'ssn',
  'tin',
])

function redact(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map(redact)
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (REDACTED_KEYS.has(k)) {
        out[k] = '[REDACTED]'
      } else {
        out[k] = redact(v)
      }
    }
    return out
  }
  return value
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  const keys = Object.keys(value as Record<string, unknown>).sort()
  const inner = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalize((value as Record<string, unknown>)[k])}`,
  )
  return `{${inner.join(',')}}`
}

function mapOutcome(outcome: LegacyOutcome): CanonicalDecision {
  if (outcome === 'denied') return 'denied'
  if (outcome === 'approved_required') return 'approval_required'
  return 'allowed'
}

function computeRequestHash(input: RecordDecisionInput, redactedContext: unknown): string {
  const subject = {
    type: input.type,
    orgId: input.orgId,
    domain: input.domain,
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: input.action,
    resource: input.resource,
    resourceId: input.resourceId ?? null,
    decision: mapOutcome(input.outcome),
    reasonCode: input.reasonCode,
    policyId: input.policyId,
    policyVersion: input.policyVersion,
    workflowId: input.workflowId ?? null,
    caseId: input.caseId ?? null,
    correlationId: input.correlationId ?? null,
    requestId: input.requestId ?? null,
    evaluatedContext: redactedContext,
  }
  return createHash('sha256').update(canonicalize(subject)).digest('hex')
}

function rowToRecord(row: DecisionEventRow, requestId?: string | null): DecisionRecord {
  const metadata =
    row.evaluatedContext && typeof row.evaluatedContext === 'object'
      ? (row.evaluatedContext as Record<string, unknown>)
      : {}
  return {
    id: row.id,
    type: row.eventType as DecisionEventType,
    orgId: row.orgId,
    domain: row.domain,
    actorId: row.actorUserId,
    actorRole: row.actorRole,
    action: row.action,
    resource: row.resourceType,
    resourceId: row.resourceId,
    outcome: row.decision as CanonicalDecision,
    reasonCode: row.reasonCode,
    reason: row.explanation,
    policyId: row.policyId,
    policyVersion: row.policyVersion,
    policyIds: [row.policyId],
    workflowId: row.workflowId,
    caseId: row.caseId,
    correlationId: row.correlationId,
    requestId: requestId ?? null,
    traceId: row.traceId,
    metadata,
    requestHash: row.requestHash,
    recordedAt: row.createdAt.toISOString(),
  }
}

// ── Writer ───────────────────────────────────────────────────────────────────

export async function recordDecisionEvent(input: RecordDecisionInput): Promise<DecisionRecord> {
  const rawContext = input.evaluatedContext ?? input.metadata ?? {}
  const redactedContext = redact(rawContext) as Record<string, unknown>
  const requestHash = computeRequestHash(input, redactedContext)
  const decision = mapOutcome(input.outcome)

  const insertValues = {
    orgId: input.orgId,
    domain: input.domain,
    workflowId: input.workflowId ?? null,
    caseId: input.caseId ?? null,
    actorUserId: input.actorId,
    actorRole: input.actorRole,
    action: input.action,
    resourceType: input.resource,
    resourceId: input.resourceId ?? null,
    decision,
    reasonCode: input.reasonCode,
    explanation: input.reason ?? null,
    policyId: input.policyId,
    policyVersion: input.policyVersion,
    evaluatedContext: redactedContext,
    requestHash,
    correlationId: input.correlationId ?? null,
    traceId: input.traceId ?? null,
    eventType: input.type,
  }

  let inserted: DecisionEventRow
  try {
    const rows = await platformDb.insert(decisionEvents).values(insertValues).returning()
    inserted = rows[0]!
  } catch (err) {
    logger.error('Failed to persist decision event', {
      error: err instanceof Error ? err.message : String(err),
      type: input.type,
      orgId: input.orgId,
      reasonCode: input.reasonCode,
    })
    // FAIL CLOSED: if we cannot record the decision, surface the error to the
    // caller. The caller (workflow-authorizer) MUST treat persistence failure
    // as a denial — never silently allow an unaudited action.
    throw err
  }

  const record = rowToRecord(inserted, input.requestId ?? null)

  // Mirror to the audit ledger for cross-app traceability. Non-fatal — the
  // canonical record is already durable in decision_events.
  try {
    await recordAuditEvent({
      orgId: input.orgId,
      actorClerkUserId: input.actorId,
      action: `decision.${input.type}`,
      targetType: input.resource,
      targetId: input.resourceId,
      afterJson: {
        decisionId: record.id,
        decision,
        reasonCode: input.reasonCode,
        policyId: input.policyId,
        policyVersion: input.policyVersion,
        correlationId: input.correlationId,
        workflowId: input.workflowId,
        requestHash,
      },
    })
  } catch (auditErr) {
    logger.warn('Failed to mirror decision event to audit trail', {
      decisionId: record.id,
      error: auditErr instanceof Error ? auditErr.message : String(auditErr),
    })
  }

  logger.info('Decision event recorded', {
    id: record.id,
    type: record.type,
    decision,
    reasonCode: input.reasonCode,
    policyId: input.policyId,
    policyVersion: input.policyVersion,
    orgId: input.orgId,
    workflowId: input.workflowId,
    correlationId: input.correlationId,
  })

  return record
}

// ── Read API ─────────────────────────────────────────────────────────────────

export async function getDecisionsByCorrelationId(correlationId: string): Promise<DecisionRecord[]> {
  const rows = await platformDb
    .select()
    .from(decisionEvents)
    .where(eq(decisionEvents.correlationId, correlationId))
    .orderBy(desc(decisionEvents.createdAt))
  return rows.map((r) => rowToRecord(r))
}

export async function getDecisionsByWorkflowId(workflowId: string): Promise<DecisionRecord[]> {
  const rows = await platformDb
    .select()
    .from(decisionEvents)
    .where(eq(decisionEvents.workflowId, workflowId))
    .orderBy(desc(decisionEvents.createdAt))
  return rows.map((r) => rowToRecord(r))
}

export async function getDecisionsForOrg(orgId: string, limit = 50): Promise<DecisionRecord[]> {
  const rows = await platformDb
    .select()
    .from(decisionEvents)
    .where(eq(decisionEvents.orgId, orgId))
    .orderBy(desc(decisionEvents.createdAt))
    .limit(limit)
  return rows.map((r) => rowToRecord(r))
}

export async function getDecisionsByCaseId(caseId: string): Promise<DecisionRecord[]> {
  const rows = await platformDb
    .select()
    .from(decisionEvents)
    .where(eq(decisionEvents.caseId, caseId))
    .orderBy(desc(decisionEvents.createdAt))
  return rows.map((r) => rowToRecord(r))
}

export async function getDecisionsByActor(
  orgId: string,
  actorUserId: string,
  limit = 100,
): Promise<DecisionRecord[]> {
  const rows = await platformDb
    .select()
    .from(decisionEvents)
    .where(and(eq(decisionEvents.orgId, orgId), eq(decisionEvents.actorUserId, actorUserId)))
    .orderBy(desc(decisionEvents.createdAt))
    .limit(limit)
  return rows.map((r) => rowToRecord(r))
}

export async function getDecisionsByPolicy(
  policyId: string,
  policyVersion?: string,
  limit = 100,
): Promise<DecisionRecord[]> {
  const filter = policyVersion
    ? and(eq(decisionEvents.policyId, policyId), eq(decisionEvents.policyVersion, policyVersion))
    : eq(decisionEvents.policyId, policyId)
  const rows = await platformDb
    .select()
    .from(decisionEvents)
    .where(filter)
    .orderBy(desc(decisionEvents.createdAt))
    .limit(limit)
  return rows.map((r) => rowToRecord(r))
}

export async function getDecisionsByDateRange(
  orgId: string,
  from: Date,
  to: Date,
  limit = 500,
): Promise<DecisionRecord[]> {
  const rows = await platformDb
    .select()
    .from(decisionEvents)
    .where(
      and(
        eq(decisionEvents.orgId, orgId),
        sql`${decisionEvents.createdAt} >= ${from.toISOString()}::timestamptz`,
        sql`${decisionEvents.createdAt} <= ${to.toISOString()}::timestamptz`,
      ),
    )
    .orderBy(desc(decisionEvents.createdAt))
    .limit(limit)
  return rows.map((r) => rowToRecord(r))
}

// Internal helpers exported for tests only.
export const __internal = { redact, canonicalize, computeRequestHash, mapOutcome }
