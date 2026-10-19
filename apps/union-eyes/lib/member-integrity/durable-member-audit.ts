/**
 * Durable audit for organization-member mutations.
 *
 * The writer runs on the caller's organization transaction. Canonical mode
 * appends the hash chain and propagates errors. Legacy mode inserts
 * `audit_security.audit_logs` with no catch. Either failure rejects, and
 * the caller's transaction rolls the protected change back with it.
 *
 * Metadata is provenance only: no name, email, phone, or submitted payload.
 */

import type { RLSTx } from '@/lib/db/with-rls-context'
import { auditLogs } from '@/db/schema/domains/infrastructure/audit'
import { appendMandatoryAudit } from '@/lib/audit/mandatory-audit'
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap'

export type MemberAuditOperation =
  | 'create'
  | 'update'
  | 'status_change'
  | 'role_change'
  | 'soft_delete'
  | 'merge'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const RESTRICTED_METADATA_KEYS = new Set([
  'name',
  'email',
  'phone',
  'payload',
  'data',
  'members',
  'memberids',
  'membershipnumber',
  'notes',
  'metadata',
])

export function memberAuditEventType(operation: MemberAuditOperation): string {
  if (operation === 'create') return 'data.create'
  return 'data.update'
}

export function assertMemberAuditMetadata(value: unknown, seen = new Set<unknown>()): void {
  if (value === null || typeof value !== 'object') return
  if (seen.has(value)) return
  seen.add(value)
  if (Array.isArray(value)) {
    for (const item of value) assertMemberAuditMetadata(item, seen)
    return
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (RESTRICTED_METADATA_KEYS.has(key.toLowerCase())) {
      throw new Error('Member audit metadata rejected')
    }
    assertMemberAuditMetadata(item, seen)
  }
}

export async function persistDurableMemberAudit(
  tx: RLSTx,
  input: {
    actorUserId: string
    organizationId: string
    operation: MemberAuditOperation
    targetId: string | null
    count?: number
  },
): Promise<void> {
  const metadata = {
    operation: input.operation,
    outcome: 'success' as const,
    eventType: memberAuditEventType(input.operation),
    targetId: input.targetId,
    count: input.count ?? 1,
  }
  assertMemberAuditMetadata(metadata)

  const action = `organization_member_${input.operation}`
  const resourceId = input.targetId && UUID_PATTERN.test(input.targetId) ? input.targetId : null
  if (currentStateContextEnabled()) {
    const written = await appendMandatoryAudit(tx, {
      organizationId: input.organizationId,
      action,
      resourceType: 'organization_member',
      resourceId,
      userId: input.actorUserId,
      details: {
        eventType: metadata.eventType,
        severity: 'error',
        outcome: 'success',
        metadata,
      },
    })
    if (!written) throw new Error('Member audit was not persisted')
    return
  }

  await tx.insert(auditLogs).values({
    action,
    resourceType: 'organization_member',
    resourceId,
    userId: input.actorUserId,
    organizationId: input.organizationId,
    severity: 'error',
    outcome: 'success',
    metadata,
  })
}
