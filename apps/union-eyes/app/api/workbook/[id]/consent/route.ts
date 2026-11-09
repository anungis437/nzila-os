/** DELETE withdraws workbook consent. All ordinary workbook routes use the shared access boundary, which refuses the withdrawn record. */
import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { workbooks } from '@/db/schema/workbook-schema';
import { extractWorkbookCapability } from '@/lib/workbook/workbook-capability';
import { withClaimedWorkbookAccess } from '@/lib/workbook/access-control';
import { activeWorkbookConsent } from '@/lib/workbook/consent';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await withClaimedWorkbookAccess(
    { workbookId: id, operation: 'write', capability: extractWorkbookCapability(request, id) },
    async (authority) => {
      const ownershipScope = authority.claimedByUserId
        ? eq(workbooks.claimedByUserId, authority.claimedByUserId)
        : isNull(workbooks.claimedByUserId);
      const [row] = await authority.tx
        .select({ consent: workbooks.consent })
        .from(workbooks)
        .where(and(eq(workbooks.id, id), ownershipScope))
        .limit(1);
      if (!row || !activeWorkbookConsent(row.consent)) return false;
      const consent = { ...row.consent, withdrawnAt: new Date().toISOString() };
      await authority.tx
        .update(workbooks)
        .set({ consent, updatedAt: new Date() })
        .where(and(
          eq(workbooks.id, id),
          authority.claimedByUserId
            ? eq(workbooks.claimedByUserId, authority.claimedByUserId)
            : isNull(workbooks.claimedByUserId),
        ));
      if (authority.actorUserId && authority.claimedOrgId) {
        await persistAtomicAudit(authority.tx, {
          organizationId: authority.claimedOrgId,
          userId: authority.actorUserId,
          action: 'workbook.consent.withdraw',
          resourceType: 'workbooks',
          resourceId: id,
          details: { noticeVersion: consent.noticeVersion, purposes: consent.purposes },
        });
      } else if (authority.appendPublicIntakeAudit) {
        await authority.appendPublicIntakeAudit({
          surface: 'workbook.consent',
          action: 'workbook.consent.withdraw',
          operation: 'update',
          subjectKind: 'unclaimed_workbook',
          subjectId: id,
          details: { noticeVersion: consent.noticeVersion },
        });
      }
      return true;
    },
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return result.value
    ? NextResponse.json({ withdrawn: true })
    : NextResponse.json({ error: 'Workbook consent is not active' }, { status: 409 });
}
