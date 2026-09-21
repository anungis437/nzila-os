/**
 * GET /api/workbook/[id]/export
 *
 * Streams the Governance Entropy Workbook PDF. Tier-gated: only available
 * for tiers >= workbook_self_guided. Unclaimed workbooks (no buyer bound)
 * are rejected.
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { workbooks } from '@/db/schema/workbook-schema';
import { generateWorkbookPdf } from '@/lib/workbook-pdf/generateWorkbookPdf';
import { withClaimedWorkbookAccess } from '@/lib/workbook/access-control';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ELIGIBLE_TIERS = new Set([
  'workbook_self_guided',
  'workbook_facilitated',
  'workbook_enterprise',
]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workbookId } = await params;

  try {
    // Authorization is resolved first (claimant or same-organization peer);
    // the tier read and every protected PDF child read then run inside the DB
    // execution context that matches the resolved authority. The export
    // surface is claimed-only: an unclaimed (pre-claim) workbook has no
    // identity-bound owner and cannot be exported by the bearer id alone.
    const access = await withClaimedWorkbookAccess(
      { workbookId, operation: 'read' },
      async (authority) => {
        if (authority.kind === 'preclaim') {
          return { kind: 'unclaimed' as const };
        }

        const [wb] = await db
          .select({ reportTierId: workbooks.reportTierId })
          .from(workbooks)
          .where(eq(workbooks.id, workbookId))
          .limit(1);

        if (!wb) {
          return { kind: 'not_found' as const };
        }
        if (!wb.reportTierId || !ELIGIBLE_TIERS.has(wb.reportTierId)) {
          return { kind: 'tier' as const };
        }

        const buffer = await generateWorkbookPdf({ workbookId });
        if (!buffer) {
          return { kind: 'not_found' as const };
        }
        return { kind: 'ok' as const, buffer };
      },
    );

    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const outcome = access.value;
    if (outcome.kind === 'unclaimed') {
      return NextResponse.json({ error: 'Workbook not claimed' }, { status: 403 });
    }
    if (outcome.kind === 'not_found') {
      return NextResponse.json({ error: 'Workbook not found' }, { status: 404 });
    }
    if (outcome.kind === 'tier') {
      return NextResponse.json(
        { error: 'Export requires the Self-Guided Workbook tier or higher.' },
        { status: 402 },
      );
    }

    return new NextResponse(new Uint8Array(outcome.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="governance-entropy-workbook-${workbookId}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    logger.error('[workbook-export] render error', { workbookId, err });
    return NextResponse.json(
      { error: 'Failed to render workbook PDF' },
      { status: 503 },
    );
  }
}
