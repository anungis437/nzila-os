/**
 * Case Audit Timeline API
 *
 * GET /api/cases/[caseId]/audit
 *
 * Returns the audit trail for a case, ordered newest-first.
 * PR-031: Case Timeline / Audit Viewer
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { auditDataAccess } from '@/lib/audit-logger';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { caseId } = await params;

  try {
  const rows = await withRLSContext(async () => {
    return db
      .select({
        auditId: auditLogs.auditId,
        action: auditLogs.action,
        userId: auditLogs.userId,
        severity: auditLogs.severity,
        outcome: auditLogs.outcome,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.resourceType, 'claims'),
          eq(auditLogs.resourceId, caseId),
        ),
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(200);
  });

  // Audit the access itself
  await auditDataAccess({
    userId,
    organizationId: orgId,
    resource: 'audit_logs',
    action: 'list',
    details: { caseId, resultCount: rows.length },
  });

  return NextResponse.json({ caseId, timeline: rows });
  } catch {
    return NextResponse.json({ error: 'Failed to retrieve audit timeline' }, { status: 500 });
  }
}
