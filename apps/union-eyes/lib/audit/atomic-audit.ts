import type { RLSTx } from '@/lib/db/with-rls-context'
import { auditLogs } from '@/db/schema/domains/infrastructure/audit'
import { appendMandatoryAudit } from '@/lib/audit/mandatory-audit'
import type { CanonicalAuditEntry } from '@/lib/audit/canonical-audit-chain'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Audit that commits or rolls back with the caller's transaction in every deployment mode.
 *
 * Canonical V2 appends to the hash-chained ledger; otherwise the same transaction inserts into
 * `audit_logs`. There is no separate-connection fallback: a failed write throws, so the protected
 * mutation never commits without its record. System actors and non-UUID resource references are
 * kept in the metadata because the relational columns reference users and require UUIDs.
 */
export async function persistAtomicAudit(
  tx: RLSTx,
  entry: CanonicalAuditEntry,
  outcome: 'success' | 'failure' = 'success',
): Promise<void> {
  if (await appendMandatoryAudit(tx, entry)) return

  const systemActor = entry.userId?.startsWith('system:') ?? false
  const resourceIsUuid = entry.resourceId ? UUID.test(entry.resourceId) : false
  await tx.insert(auditLogs).values({
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: resourceIsUuid ? entry.resourceId : null,
    userId: systemActor ? null : (entry.userId ?? null),
    organizationId: entry.organizationId,
    severity: outcome === 'failure' ? 'warning' : 'info',
    outcome,
    metadata: {
      ...entry.details,
      ...(systemActor ? { actor: entry.userId } : {}),
      ...(entry.resourceId && !resourceIsUuid ? { resourceRef: entry.resourceId } : {}),
    },
  })
}
