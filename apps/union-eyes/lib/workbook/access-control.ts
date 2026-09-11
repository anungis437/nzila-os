/**
 * Shared claimed-workbook ownership check.
 *
 * Once a workbook is claimed (see app/api/workbook/[id]/claim/route.ts),
 * its identity-linked child data (memory holders, governance lineage,
 * etc.) must only be accessible to the claiming user or a member of the
 * same organization — the workbookId alone is no longer sufficient bearer
 * authority once real identity is attached. Mirrors the ownership check
 * already implemented in app/api/workbook/[id]/export/route.ts.
 */
import { auth } from '@nzila/platform-auth/entra/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { workbooks } from '@/db/schema/workbook-schema';
import { getOrganizationIdForUser } from '@/lib/organization-utils';

export type WorkbookAccessResult =
  | { ok: true }
  | { ok: false; status: 401 | 403 | 404; error: string };

/**
 * Verify the current request may access a workbook's claimed identity-linked
 * child data. Unclaimed workbooks remain accessible via the workbookId
 * bearer credential alone (pseudonymous-by-design, matches the create/claim
 * flow); claimed workbooks require the caller to be the claimant or share
 * their organization.
 */
export async function verifyClaimedWorkbookAccess(workbookId: string): Promise<WorkbookAccessResult> {
  const [wb] = await db
    .select({ id: workbooks.id, claimedByUserId: workbooks.claimedByUserId })
    .from(workbooks)
    .where(eq(workbooks.id, workbookId))
    .limit(1);

  if (!wb) {
    return { ok: false, status: 404, error: 'Workbook not found' };
  }

  if (!wb.claimedByUserId) {
    // Unclaimed: the workbookId itself is the bearer credential.
    return { ok: true };
  }

  const { userId } = await auth();
  if (!userId) {
    return { ok: false, status: 401, error: 'Authentication required' };
  }

  if (wb.claimedByUserId === userId) {
    return { ok: true };
  }

  const requesterOrgId = await getOrganizationIdForUser(userId).catch(() => null);
  const ownerOrgId = await getOrganizationIdForUser(wb.claimedByUserId).catch(() => null);
  if (!requesterOrgId || !ownerOrgId || requesterOrgId !== ownerOrgId) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }

  return { ok: true };
}
