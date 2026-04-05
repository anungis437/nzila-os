/**
 * Evidence Export API
 *
 * GET /api/cases/[caseId]/export
 *
 * Returns a sealed JSON evidence pack for the given case.
 * PR-032: Evidence Export + Seal Verification
 */

import { NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { db } from '@/db';
import { claims, claimUpdates } from '@/db/schema';
import { auditLogs } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { buildEvidencePack } from '@/lib/evidence-export';
import { auditCaseExport } from '@/lib/audited-case-mutations';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await requireEntitlement(orgId, 'grievance_case_suite');

  const { caseId } = await params;

  try {
  // Fetch case, notes, and audit trail in parallel
  const [caseRows, noteRows, auditRows] = await withRLSContext(async () => {
    return Promise.all([
      db.select().from(claims).where(eq(claims.claimId, caseId)).limit(1),
      db
        .select()
        .from(claimUpdates)
        .where(eq(claimUpdates.claimId, caseId))
        .orderBy(desc(claimUpdates.createdAt)),
      db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.resourceType, 'claims'),
            eq(auditLogs.resourceId, caseId),
          ),
        )
        .orderBy(desc(auditLogs.createdAt)),
    ]);
  });

  if (caseRows.length === 0) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  }

  const pack = buildEvidencePack({
    exportedBy: userId,
    caseId,
    organizationId: orgId,
    caseRecord: caseRows[0] as unknown as Record<string, unknown>,
    notes: noteRows as unknown as Record<string, unknown>[],
    auditTrail: auditRows as unknown as Record<string, unknown>[],
  });

  // Audit the export event
  await auditCaseExport({ userId, organizationId: orgId, caseId, format: 'json' });

  return NextResponse.json(pack, {
    headers: {
      'Content-Disposition': `attachment; filename="evidence-${caseId}.json"`,
    },
  });
  } catch {
    return NextResponse.json({ error: 'Failed to export evidence' }, { status: 500 });
  }
}
