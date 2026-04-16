/**
 * Control Plane — Database-backed audit logger with hash-chain integrity
 *
 * Authority-layer audit module. Records immutable audit events into the
 * shared `audit_events` table. Maintains a SHA-256 hash chain for
 * tamper-evidence.
 *
 * All governance decisions, policy evaluations, and execution approvals
 * that flow through the Control Plane must be recorded here.
 */
import 'server-only'

import { platformDb } from '@nzila/db/platform'
import { auditEvents } from '@nzila/db/schema'
import { computeEntryHash } from '@nzila/os-core/hash'
import { eq, desc, and } from 'drizzle-orm'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('control-plane:audit-db')

// ── Types ───────────────────────────────────────────────────────────────────

export interface RecordAuditEventInput {
  orgId: string
  actorClerkUserId: string
  actorRole?: string
  action: string
  targetType: string
  targetId?: string
  beforeJson?: Record<string, unknown>
  afterJson?: Record<string, unknown>
}

export interface AuditEventRow {
  id: string
  orgId: string
  actorClerkUserId: string
  actorRole: string | null
  action: string
  targetType: string
  targetId: string | null
  beforeJson: unknown
  afterJson: unknown
  hash: string
  previousHash: string | null
  createdAt: Date
}

// ── Well-known action taxonomy ──────────────────────────────────────────────

export const AUDIT_ACTIONS = {
  // Governance lifecycle
  GOVERNANCE_ACTION_CREATE: 'governance_action.create',
  GOVERNANCE_ACTION_SUBMIT: 'governance_action.submit',
  GOVERNANCE_ACTION_APPROVE: 'governance_action.approve',
  GOVERNANCE_ACTION_REJECT: 'governance_action.reject',
  GOVERNANCE_ACTION_EXECUTE: 'governance_action.execute',

  // Approval lifecycle
  APPROVAL_CREATE: 'approval.create',
  APPROVAL_VOTE: 'approval.vote',
  APPROVAL_DECIDE: 'approval.decide',

  // Policy
  POLICY_ALLOWED: 'policy.allowed',
  POLICY_DENIED: 'policy.denied',
  POLICY_APPROVAL_REQUIRED: 'policy.approval_required',

  // Workflow
  WORKFLOW_TRIGGERED: 'workflow.triggered',
  WORKFLOW_COMPLETED: 'workflow.completed',
  WORKFLOW_FAILED: 'workflow.failed',

  // Org lifecycle
  ORG_CREATE: 'org.create',
  ORG_UPDATE: 'org.update',
  MEMBER_ADD: 'member.add',
  MEMBER_REMOVE: 'member.remove',
  MEMBER_ROLE_CHANGE: 'member.role_change',

  // Evidence
  EVIDENCE_PACK_CREATE: 'evidence_pack.create',
  EVIDENCE_PACK_SEAL: 'evidence_pack.seal',

  // Authorization failures
  AUTHORIZATION_DENIED: 'authorization.denied',
} as const

// ── Core: record an audit event with hash chain ─────────────────────────────

/**
 * Record an immutable audit event with hash-chain integrity.
 */
export async function recordAuditEvent(
  input: RecordAuditEventInput,
): Promise<{ id: string; hash: string; previousHash: string | null }> {
  const [latest] = await platformDb
    .select({ hash: auditEvents.hash })
    .from(auditEvents)
    .where(eq(auditEvents.orgId, input.orgId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(1)

  const previousHash = latest?.hash ?? null

  const payload = {
    orgId: input.orgId,
    actorClerkUserId: input.actorClerkUserId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    afterJson: input.afterJson ?? null,
    timestamp: new Date().toISOString(),
  }

  const hash = computeEntryHash(payload, previousHash)

  const [row] = await platformDb
    .insert(auditEvents)
    .values({
      orgId: input.orgId,
      actorClerkUserId: input.actorClerkUserId,
      actorRole: input.actorRole ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? undefined,
      beforeJson: input.beforeJson ?? undefined,
      afterJson: input.afterJson ?? undefined,
      hash,
      previousHash,
    })
    .returning({ id: auditEvents.id, hash: auditEvents.hash })

  logger.info('[AUDIT]', {
    detail: JSON.stringify({
      id: row.id,
      orgId: input.orgId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      source: 'control-plane',
      hash: hash.slice(0, 12) + '…',
    }),
  })

  return { id: row.id, hash, previousHash }
}

// ── Verify the hash chain for an org ────────────────────────────────────────

export interface ChainVerificationResult {
  valid: boolean
  totalEvents: number
  brokenAtIndex?: number
  brokenEventId?: string
}

export async function verifyEntityAuditChain(
  orgId: string,
): Promise<ChainVerificationResult> {
  const events = await platformDb
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.orgId, orgId))
    .orderBy(auditEvents.createdAt)

  if (events.length === 0) return { valid: true, totalEvents: 0 }

  for (let i = 0; i < events.length; i++) {
    const event = events[i]
    const expectedPrev = i === 0 ? null : events[i - 1].hash
    if (event.previousHash !== expectedPrev) {
      return { valid: false, totalEvents: events.length, brokenAtIndex: i, brokenEventId: event.id }
    }
    const payload = {
      orgId: event.orgId,
      actorClerkUserId: event.actorClerkUserId,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId ?? null,
      afterJson: event.afterJson ?? null,
      timestamp: event.createdAt.toISOString(),
    }
    const recomputed = computeEntryHash(payload, event.previousHash)
    if (recomputed !== event.hash) {
      return { valid: false, totalEvents: events.length, brokenAtIndex: i, brokenEventId: event.id }
    }
  }

  return { valid: true, totalEvents: events.length }
}

// ── Query helpers ────────────────────────────────────────────────────────────

export async function getAuditTrailForTarget(
  orgId: string,
  targetType: string,
  targetId: string,
): Promise<AuditEventRow[]> {
  return platformDb
    .select()
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.orgId, orgId),
        eq(auditEvents.targetType, targetType),
        eq(auditEvents.targetId, targetId),
      ),
    )
    .orderBy(auditEvents.createdAt) as unknown as Promise<AuditEventRow[]>
}
