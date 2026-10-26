import { db } from '@/db';
import type { RLSTx } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import type { ClaimedWorkbookAuthority } from '@/lib/workbook/access-control';

/**
 * Records a write to a claimed workbook's identity-linked data on the executor the access boundary established, so the
 * write and its audit row commit or roll back together. Call it inside the `withClaimedWorkbookAccess` callback.
 *
 * A pre-claim workbook has no actor and no organization (the bearer id is its only authority), so there is nothing to
 * attribute and nothing is recorded. A claimed workbook with no organization to attribute to fails closed rather than
 * accepting an unattributed identity-linked write.
 */
export async function auditClaimedWorkbookWrite(
  authority: ClaimedWorkbookAuthority,
  entry: { action: string; resourceType: string; resourceId: string; details: Record<string, unknown> },
): Promise<void> {
  if (authority.kind === 'preclaim') return;
  if (!authority.actorUserId || !authority.claimedOrgId) {
    throw new Error('A claimed workbook write has no organization to record its audit under.');
  }
  await persistAtomicAudit(db as unknown as RLSTx, {
    organizationId: authority.claimedOrgId,
    userId: authority.actorUserId,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    details: { workbookId: authority.workbookId, ...entry.details },
  });
}
