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
  const systemActor = entry.userId?.startsWith('system:') ?? false
  // The canonical ledger has no outcome column: a failure (a recorded denial) is kept in its details, so it never reads as a success.
  // A system actor is not a user: as in the legacy ledger, it is stored with no user and named in the details. The ledger binds a
  // named user to the transaction's own session (db/auth/audit-author-guards.ts).
  const canonical: CanonicalAuditEntry = {
    ...entry,
    userId: systemActor ? null : entry.userId,
    details: { ...entry.details, ...(systemActor ? { actor: entry.userId } : {}), ...(outcome === 'failure' ? { outcome: 'failure' } : {}) },
  }
  if (await appendMandatoryAudit(tx, canonical)) return

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
