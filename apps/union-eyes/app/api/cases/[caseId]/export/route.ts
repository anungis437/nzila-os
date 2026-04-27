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
import {
  buildEvidencePackage,
  buildEvidenceZip,
  buildEvidencePdf,
} from '@/lib/evidence-export';
import { auditCaseExport } from '@/lib/audited-case-mutations';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { recordUnionEyesEvidenceExport } from '@/lib/pilot-metrics';
import { getOrganizationIdForUser } from '@/lib/organization-utils';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const orgId = await getOrganizationIdForUser(userId);
  await requireEntitlement(orgId, 'grievance_case_suite');

  const { caseId } = await params;
  const url = new URL(request.url);
  const format = (url.searchParams.get('format') ?? 'json').toLowerCase();
  const envelope = url.searchParams.get('envelope') === 'true';
  const verify = url.searchParams.get('verify') === 'true';

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

  const evidenceInput = {
    exportedBy: userId,
    caseId,
    organizationId: orgId,
    caseRecord: caseRows[0] as unknown as Record<string, unknown>,
    notes: noteRows as unknown as Record<string, unknown>[],
    auditTrail: auditRows as unknown as Record<string, unknown>[],
  };

  const packageEnvelope = buildEvidencePackage(evidenceInput);
  const pack = packageEnvelope.pack;

  // Audit the export event
  if (format !== 'json' && format !== 'zip' && format !== 'pdf') {
    return NextResponse.json({ error: `Unsupported format '${format}'. Use json, zip, or pdf.` }, { status: 400 });
  }

  await auditCaseExport({ userId, organizationId: orgId, caseId, format: format as 'json' | 'zip' | 'pdf' });

  const traceId = request.headers.get('x-trace-id') ?? crypto.randomUUID();
  recordUnionEyesEvidenceExport(orgId, caseId, userId, traceId).catch(() => {
    // Do not fail export path on observability errors.
  })

  if (format === 'zip') {
    const zip = await buildEvidenceZip(packageEnvelope);
    return new NextResponse(new Uint8Array(zip), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="evidence-${caseId}.zip"`,
      },
    });
  }

  if (format === 'pdf') {
    const pdf = await buildEvidencePdf(packageEnvelope);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="evidence-${caseId}.pdf"`,
      },
    });
  }

  if (envelope || verify) {
    return NextResponse.json({
      manifest: packageEnvelope.manifest,
      pack,
      verification: packageEnvelope.verification,
    }, {
      headers: {
        'Content-Disposition': `attachment; filename="evidence-${caseId}.json"`,
      },
    });
  }

  return NextResponse.json(pack, {
    headers: {
      'Content-Disposition': `attachment; filename="evidence-${caseId}.json"`,
    },
  });
  } catch {
    return NextResponse.json({ error: 'Failed to export evidence' }, { status: 500 });
  }
}
