/**
 * Nzila OS — Database-backed audit logger with hash-chain integrity
 *
 * Replaces the stdout-only audit.ts stub with a real implementation
 * that writes to the append-only `audit_events` table and maintains
 * a SHA-256 hash chain for tamper evidence.
 *
 * Usage:
 *   import { recordAuditEvent, verifyEntityAuditChain } from '@/lib/audit-db'
 *
 *   await recordAuditEvent({
 *     orgId: '...',
 *     actorClerkUserId: userId,
 *     actorRole: 'org_admin',
 *     action: 'governance_action.execute',
 *     targetType: 'governance_action',
 *     targetId: actionId,
 *     afterJson: { status: 'executed', ... },
 *   })
 */
// Platform DB for direct access to the append-only audit_events table.
// Audit-db cannot use createAuditedScopedDb (circular: audit→audit→...).
import { platformDb } from '@nzila/db/platform'
import { auditEvents } from '@nzila/db/schema'
import { computeEntryHash } from '@nzila/os-core/hash'
import { eq, desc, and, gte, lte, asc, SQL } from 'drizzle-orm'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('audit-db')

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

  // Resolution lifecycle
  RESOLUTION_CREATE: 'resolution.create',
  RESOLUTION_SIGN: 'resolution.sign',
  RESOLUTION_ARCHIVE: 'resolution.archive',

  // Equity
  LEDGER_ENTRY_CREATE: 'ledger_entry.create',
  CAP_TABLE_SNAPSHOT: 'cap_table.snapshot',
  CERTIFICATE_ISSUE: 'certificate.issue',

  // Documents
  DOCUMENT_UPLOAD: 'document.upload',
  DOCUMENT_ACCESS: 'document.access',

  // Entity admin
  ORG_CREATE: 'org.create',
  ORG_UPDATE: 'org.update',
  MEMBER_ADD: 'member.add',
  MEMBER_REMOVE: 'member.remove',
  MEMBER_ROLE_CHANGE: 'member.role_change',

  // Evidence
  EVIDENCE_PACK_CREATE: 'evidence_pack.create',
  EVIDENCE_PACK_SEAL: 'evidence_pack.seal',
  EVIDENCE_PACK_VERIFY: 'evidence_pack.verify',

  // Data export (required for regulated data handling)
  DATA_EXPORT: 'data.export',
  DATA_EXPORT_REQUEST: 'data.export_request',

  // Auth / security configuration changes
  AUTH_CONFIG_CHANGE: 'auth.config_change',

  // Authorization failures (for threat detection)
  AUTHORIZATION_DENIED: 'authorization.denied',
} as const

// ── Core: record an audit event with hash chain ─────────────────────────────

/**
 * Record an immutable audit event with hash-chain integrity.
 *
 * 1. Fetches the latest audit event for the entity to get `previousHash`.
 * 2. Computes SHA-256 hash of { payload, previousHash }.
 * 3. Inserts an append-only row into `audit_events`.
 *
 * Returns the inserted row's id and hash.
 */
export async function recordAuditEvent(
  input: RecordAuditEventInput,
): Promise<{ id: string; hash: string; previousHash: string | null }> {
  // 1. Get the latest event for this entity (for hash chain)
  const [latest] = await platformDb
    .select({ hash: auditEvents.hash })
    .from(auditEvents)
    .where(eq(auditEvents.orgId, input.orgId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(1)

  const previousHash = latest?.hash ?? null

  // 2. Build the hashable payload (deterministic subset)
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

  // 3. Insert append-only row
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

  // Also log to stdout for observability pipelines
  logger.info('[AUDIT]', {
    detail: JSON.stringify({
      id: row.id,
      orgId: input.orgId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      hash: hash.slice(0, 12) + '…',
    }),
  })

  return { id: row.id, hash, previousHash }
}

// ── Verify the hash chain for an entity ─────────────────────────────────────

export interface ChainVerificationResult {
  valid: boolean
  totalEvents: number
  brokenAtIndex?: number
  brokenEventId?: string
}

/**
 * Verify the full audit event hash chain for an entity.
 *
 * Loads all events (oldest → newest) and recomputes each hash
 * to confirm no tampering or gaps.
 */
export async function verifyEntityAuditChain(
  orgId: string,
): Promise<ChainVerificationResult> {
  const events = await platformDb
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.orgId, orgId))
    .orderBy(auditEvents.createdAt)

  if (events.length === 0) {
    return { valid: true, totalEvents: 0 }
  }

  for (let i = 0; i < events.length; i++) {
    const event = events[i]

    // Check previous-hash linkage
    const expectedPrev = i === 0 ? null : events[i - 1].hash
    if (event.previousHash !== expectedPrev) {
      return {
        valid: false,
        totalEvents: events.length,
        brokenAtIndex: i,
        brokenEventId: event.id,
      }
    }

    // Recompute hash
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
      return {
        valid: false,
        totalEvents: events.length,
        brokenAtIndex: i,
        brokenEventId: event.id,
      }
    }
  }

  return { valid: true, totalEvents: events.length }
}

// ── Query helpers (for evidence pack extraction) ────────────────────────────

/**
 * Get audit events for a specific target (e.g. all events for a governance action).
 */
export async function getAuditTrailForTarget(
  orgId: string,
  _targetType: string,
  _targetId: string,
): Promise<AuditEventRow[]> {
  return platformDb
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.orgId, orgId))
    .orderBy(auditEvents.createdAt) as unknown as Promise<AuditEventRow[]>
  // NOTE: drizzle doesn't chain .where() with AND automatically for
  // multiple calls — use `and()` for compound filters when needed.
  // The above returns all entity events; filter in-memory for target
  // or extend with `and(eq(auditEvents.targetType, targetType), eq(auditEvents.targetId, targetId))`
}

/**
 * Export audit events as a JSON buffer (for evidence pack artifacts).
 */
export async function exportAuditTrailBuffer(
  orgId: string,
  targetType: string,
  targetId: string,
): Promise<Buffer> {
  const events = await getAuditTrailForTarget(orgId, targetType, targetId)
  // Filter to matching target
  const filtered = events.filter(
    (e) => e.targetType === targetType && e.targetId === targetId,
  )
  return Buffer.from(JSON.stringify(filtered, null, 2))
}

// ── Query audit events with filters ─────────────────────────────────────────

export interface QueryAuditEventsInput {
  orgId: string
  actorId?: string
  action?: string
  targetType?: string
  targetId?: string
  startTime?: Date
  endTime?: Date
  limit?: number
  offset?: number
}

export interface QueryAuditEventsResult {
  events: AuditEventRow[]
  total: number
  limit: number
  offset: number
}

/**
 * Query audit events with optional filters for actor, action, target, and time range.
 * Results are org-scoped (mandatory) and ordered newest-first.
 * Maximum 200 rows per page.
 */
export async function queryAuditEvents(
  input: QueryAuditEventsInput,
): Promise<QueryAuditEventsResult> {
  const pageLimit = Math.min(input.limit ?? 50, 200)
  const pageOffset = input.offset ?? 0

  const conditions: SQL[] = [eq(auditEvents.orgId, input.orgId)]

  if (input.actorId) {
    conditions.push(eq(auditEvents.actorClerkUserId, input.actorId))
  }
  if (input.action) {
    conditions.push(eq(auditEvents.action, input.action))
  }
  if (input.targetType) {
    conditions.push(eq(auditEvents.targetType, input.targetType))
  }
  if (input.targetId) {
    conditions.push(eq(auditEvents.targetId, input.targetId))
  }
  if (input.startTime) {
    conditions.push(gte(auditEvents.createdAt, input.startTime))
  }
  if (input.endTime) {
    conditions.push(lte(auditEvents.createdAt, input.endTime))
  }

  const where = and(...conditions)!

  const [countResult, events] = await Promise.all([
    platformDb
      .select({ count: auditEvents.id })
      .from(auditEvents)
      .where(where)
      .then((rows) => rows.length),
    platformDb
      .select()
      .from(auditEvents)
      .where(where)
      .orderBy(desc(auditEvents.createdAt))
      .limit(pageLimit)
      .offset(pageOffset) as unknown as Promise<AuditEventRow[]>,
  ])

  return {
    events,
    total: countResult,
    limit: pageLimit,
    offset: pageOffset,
  }
}
