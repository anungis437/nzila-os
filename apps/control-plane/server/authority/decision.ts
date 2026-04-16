/**
 * Control Plane — Decision Event Recorder
 *
 * Records every authority decision as an immutable, hash-chained event.
 * Decision events are the authoritative record of what the Control Plane
 * decided, why it decided it, and who was involved.
 *
 * All authority services in the Control Plane MUST call recordDecisionEvent
 * for every material decision (policy allow/deny, workflow auth, entitlement
 * resolution, governance action lifecycle).
 *
 * These records are:
 *   - append-only (never updated or deleted)
 *   - hash-chained for tamper detection
 *   - queryable by correlationId, workflowId, orgId, actorId
 */
import 'server-only'

import { createLogger } from '@nzila/os-core'
import { computeEntryHash } from '@nzila/os-core/hash'
import type { DecisionEventType } from '@nzila/platform-contracts/control-system'
import { recordAuditEvent } from '@/lib/audit-db'

const logger = createLogger('control-plane:authority:decision')

// ── Types ────────────────────────────────────────────────────────────────────

export interface RecordDecisionInput {
  type: DecisionEventType
  orgId: string
  actorId: string
  action: string
  resource: string
  resourceId?: string
  outcome: 'allowed' | 'denied' | 'approved_required' | 'executed' | 'recorded'
  reason?: string
  policyIds?: string[]
  workflowId?: string
  correlationId?: string
  requestId?: string
  metadata?: Record<string, unknown>
}

export interface DecisionRecord {
  id: string
  type: DecisionEventType
  orgId: string
  actorId: string
  action: string
  resource: string
  resourceId: string | null
  outcome: string
  reason: string | null
  policyIds: string[]
  workflowId: string | null
  correlationId: string | null
  requestId: string | null
  metadata: Record<string, unknown>
  entryHash: string
  previousHash: string | null
  recordedAt: string
}

// ── In-memory store (dev-mode fallback) ────────────────────────────────────
// Production: write to `decision_events` table via platformDb
const decisionStore: DecisionRecord[] = []

let previousHash: string | null = null

/**
 * Record an authority decision event. Immutable, hash-chained.
 */
export async function recordDecisionEvent(
  input: RecordDecisionInput,
): Promise<DecisionRecord> {
  const id = crypto.randomUUID()
  const recordedAt = new Date().toISOString()

  const payload = {
    id,
    type: input.type,
    orgId: input.orgId,
    actorId: input.actorId,
    action: input.action,
    resource: input.resource,
    outcome: input.outcome,
    recordedAt,
  }

  const entryHash = computeEntryHash(payload, previousHash)

  const record: DecisionRecord = {
    id,
    type: input.type,
    orgId: input.orgId,
    actorId: input.actorId,
    action: input.action,
    resource: input.resource,
    resourceId: input.resourceId ?? null,
    outcome: input.outcome,
    reason: input.reason ?? null,
    policyIds: input.policyIds ?? [],
    workflowId: input.workflowId ?? null,
    correlationId: input.correlationId ?? null,
    requestId: input.requestId ?? null,
    metadata: input.metadata ?? {},
    entryHash,
    previousHash,
    recordedAt,
  }

  previousHash = entryHash
  decisionStore.push(record)

  logger.info('Decision event recorded', {
    id,
    type: input.type,
    outcome: input.outcome,
    orgId: input.orgId,
    workflowId: input.workflowId,
    correlationId: input.correlationId,
  })

  // Also write to audit trail for cross-app traceability
  try {
    await recordAuditEvent({
      orgId: input.orgId,
      actorClerkUserId: input.actorId,
      action: `decision.${input.type}`,
      targetType: input.resource,
      targetId: input.resourceId,
      afterJson: {
        decisionId: id,
        outcome: input.outcome,
        reason: input.reason,
        correlationId: input.correlationId,
        workflowId: input.workflowId,
        entryHash,
      },
    })
  } catch (auditErr) {
    // Non-fatal: decision record is already captured above
    logger.warn('Failed to write to audit trail for decision event', {
      decisionId: id,
      error: auditErr,
    })
  }

  return record
}

/**
 * Query decision events by correlation ID.
 */
export function getDecisionsByCorrelationId(correlationId: string): DecisionRecord[] {
  return decisionStore.filter((r) => r.correlationId === correlationId)
}

/**
 * Query decision events by workflow ID.
 */
export function getDecisionsByWorkflowId(workflowId: string): DecisionRecord[] {
  return decisionStore.filter((r) => r.workflowId === workflowId)
}

/**
 * Query decision events for an org (most recent first, limited).
 */
export function getDecisionsForOrg(orgId: string, limit = 50): DecisionRecord[] {
  return decisionStore
    .filter((r) => r.orgId === orgId)
    .slice(-limit)
    .reverse()
}
