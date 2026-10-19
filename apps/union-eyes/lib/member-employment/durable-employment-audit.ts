/**
 * Durable audit for member-employment mutations and compensation reads.
 *
 * `auditLog()` is not used. A resolved call from that helper is not evidence
 * that a row was written. This writer runs on the caller's organization
 * transaction. Canonical mode appends the hash chain and propagates errors.
 * Legacy mode inserts `audit_security.audit_logs` with no catch. Either
 * failure rejects, and the caller's transaction rolls the protected change
 * back with it.
 *
 * Callers invoke this only after the protected statement has succeeded.
 * Metadata is provenance only: no wages, leave narrative, or submitted payload.
 */

import type { RLSTx } from '@/lib/db/with-rls-context'
import { auditLogs } from '@/db/schema/domains/infrastructure/audit'
import { appendMandatoryAudit } from '@/lib/audit/mandatory-audit'
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap'

export type EmploymentAuditOperation =
  | 'create'
  | 'update'
  | 'history'
  | 'leave_create'
  | 'leave_update'
  | 'leave_approve'
  | 'classification_create'
  | 'classification_update'
  | 'compensation_read'

export type EmploymentAuditOutcome = 'success' | 'failure'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const RESTRICTED_METADATA_KEYS = new Set([
  'filters',
  'members',
  'memberrows',
  'memberids',
  'oldvalues',
  'newvalues',
  'previousvalues',
  'payload',
  'data',
  'reason',
  'notes',
  'documents',
  'hourlyrate',
  'basesalary',
  'grosswages',
  'customfields',
  'salary',
  'wages',
])

function resourceTypeFor(operation: EmploymentAuditOperation): string {
  if (operation.startsWith('leave')) return 'member_leave'
  if (operation.startsWith('classification')) return 'job_classification'
  if (operation === 'history') return 'employment_history'
  return 'member_employment'
}

export function employmentAuditEventType(operation: EmploymentAuditOperation): string {
  if (operation === 'compensation_read') return 'data.access'
  if (
    operation === 'create' ||
    operation === 'history' ||
    operation === 'leave_create' ||
    operation === 'classification_create'
  ) {
    return 'data.create'
  }
  return 'data.update'
}

function changeCategoryFor(operation: EmploymentAuditOperation): string {
  if (operation === 'leave_approve') return 'leave_approval'
  if (operation.startsWith('leave')) return 'leave'
  if (operation.startsWith('classification')) return 'job_classification'
  if (operation === 'history') return 'employment_history'
  if (operation === 'compensation_read') return 'compensation'
  return 'employment'
}

export function assertEmploymentAuditMetadata(value: unknown, seen = new Set<unknown>()): void {
  if (value === null || typeof value !== 'object') return
  if (seen.has(value)) return
  seen.add(value)
  if (Array.isArray(value)) {
    for (const item of value) assertEmploymentAuditMetadata(item, seen)
    return
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (RESTRICTED_METADATA_KEYS.has(key.toLowerCase())) {
      throw new Error('Employment audit metadata rejected')
    }
    assertEmploymentAuditMetadata(item, seen)
  }
}

function resourceIdFor(targetId: string | null): string | null {
  if (!targetId || !UUID_PATTERN.test(targetId)) return null
  return targetId
}

export async function persistDurableEmploymentAudit(
  tx: RLSTx,
  input: {
    actorUserId: string
    organizationId: string
    operation: EmploymentAuditOperation
    outcome: EmploymentAuditOutcome
    targetId: string | null
  },
): Promise<void> {
  const eventType = employmentAuditEventType(input.operation)
  const metadata = {
    operation: input.operation,
    outcome: input.outcome,
    changeCategory: changeCategoryFor(input.operation),
    eventType,
    targetId: input.targetId,
  }
  assertEmploymentAuditMetadata(metadata)

  const action = `member_employment_${input.operation}`
  const resourceId = resourceIdFor(input.targetId)
  if (currentStateContextEnabled()) {
    const written = await appendMandatoryAudit(tx, {
      organizationId: input.organizationId,
      action,
      resourceType: resourceTypeFor(input.operation),
      resourceId,
      userId: input.actorUserId,
      details: {
        eventType,
        severity: 'error',
        outcome: input.outcome,
        metadata,
      },
    })
    if (!written) throw new Error('Employment audit was not persisted')
    return
  }

  await tx.insert(auditLogs).values({
    action,
    resourceType: resourceTypeFor(input.operation),
    resourceId,
    userId: input.actorUserId,
    organizationId: input.organizationId,
    severity: 'error',
    outcome: input.outcome,
    metadata,
  })
}
