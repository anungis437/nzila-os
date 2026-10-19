/**
 * Durable audit for sensitive member-segment operations.
 *
 * `auditLog()` is not used. In legacy mode that helper catches a database
 * failure and still returns, so a resolved call is not evidence that a row
 * was written. This writer runs on the caller's organization transaction.
 * Canonical mode appends the hash chain and propagates errors. Legacy mode
 * inserts `audit_security.audit_logs` with no catch. Either failure rejects,
 * and the caller's transaction rolls the protected change back with it.
 *
 * Callers invoke this only after the protected statement has succeeded, and
 * only with outcome `success` for that statement. A statement that throws
 * does not record success.
 */

import type { RLSTx } from '@/lib/db/with-rls-context'
import { auditLogs } from '@/db/schema/domains/infrastructure/audit'
import { appendMandatoryAudit } from '@/lib/audit/mandatory-audit'
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap'

export type SensitiveSegmentOperation =
  | 'read'
  | 'list'
  | 'execute'
  | 'export'
  | 'history'
  | 'update'
  | 'delete'

export type SensitiveSegmentFact = {
  segmentId: string
  ownerUserId: string
  isPublic: boolean
}

export type SegmentAuditOutcome = 'success' | 'failure'

export type SegmentAuditRequest = {
  actorUserId: string
  segments: readonly SensitiveSegmentFact[]
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const RESTRICTED_METADATA_KEYS = new Set([
  'filters',
  'filterssnapshot',
  'filtersused',
  'members',
  'memberrows',
  'memberids',
  'oldvalues',
  'newvalues',
])

export function selectSensitiveSegmentFacts(
  actorUserId: string,
  operation: SensitiveSegmentOperation,
  segments: readonly SensitiveSegmentFact[],
): SensitiveSegmentFact[] {
  return segments.flatMap((segment) => {
    if (segment.ownerUserId === actorUserId) return []
    const crossOwnerWrite = operation === 'update' || operation === 'delete'
    if (!crossOwnerWrite && segment.isPublic !== false) return []
    return [{
      segmentId: segment.segmentId,
      ownerUserId: segment.ownerUserId,
      isPublic: segment.isPublic === true,
    }]
  })
}

function eventTypeFor(operation: SensitiveSegmentOperation): string {
  if (operation === 'update') return 'data.update'
  if (operation === 'delete') return 'data.delete'
  if (operation === 'export') return 'data.export'
  return 'data.access'
}

function assertAuditMetadata(value: unknown, seen = new Set<unknown>()): void {
  if (value === null || typeof value !== 'object') return
  if (seen.has(value)) return
  seen.add(value)
  if (Array.isArray(value)) {
    for (const item of value) assertAuditMetadata(item, seen)
    return
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (RESTRICTED_METADATA_KEYS.has(key.toLowerCase())) {
      throw new Error('Segment audit metadata rejected')
    }
    assertAuditMetadata(item, seen)
  }
}

function singleResourceId(facts: readonly SensitiveSegmentFact[]): string | null {
  if (facts.length !== 1) return null
  return UUID_PATTERN.test(facts[0].segmentId) ? facts[0].segmentId : null
}

export async function persistDurableSegmentAudit(
  tx: RLSTx,
  input: {
    actorUserId: string
    organizationId: string
    operation: SensitiveSegmentOperation
    outcome: SegmentAuditOutcome
    segments: readonly SensitiveSegmentFact[]
  },
): Promise<void> {
  const facts = selectSensitiveSegmentFacts(input.actorUserId, input.operation, input.segments)
  if (facts.length === 0) return

  const metadata = {
    crossOwner: true,
    operation: input.operation,
    outcome: input.outcome,
    eventType: eventTypeFor(input.operation),
    segments: facts,
  }
  assertAuditMetadata(metadata)

  const action = `member_segment_${input.operation}`
  if (currentStateContextEnabled()) {
    const written = await appendMandatoryAudit(tx, {
      organizationId: input.organizationId,
      action,
      resourceType: 'member_segments',
      resourceId: singleResourceId(facts),
      userId: input.actorUserId,
      details: {
        eventType: metadata.eventType,
        severity: 'error',
        outcome: input.outcome,
        metadata,
      },
    })
    if (!written) throw new Error('Segment audit was not persisted')
    return
  }

  await tx.insert(auditLogs).values({
    action,
    resourceType: 'member_segments',
    resourceId: singleResourceId(facts),
    userId: input.actorUserId,
    organizationId: input.organizationId,
    severity: 'error',
    outcome: input.outcome,
    metadata,
  })
}
