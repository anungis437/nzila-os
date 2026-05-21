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

  const [wb] = await db
    .select({
      id: workbooks.id,
      reportTierId: workbooks.reportTierId,
      status: workbooks.status,
    })
    .from(workbooks)
    .where(eq(workbooks.id, workbookId))
    .limit(1);

  if (!wb) {
    return NextResponse.json({ error: 'Workbook not found' }, { status: 404 });
  }

  if (!wb.reportTierId || !ELIGIBLE_TIERS.has(wb.reportTierId)) {
    return NextResponse.json(
      { error: 'Export requires the Self-Guided Workbook tier or higher.' },
      { status: 402 },
    );
  }

  try {
    const buffer = await generateWorkbookPdf({ workbookId });
    if (!buffer) {
      return NextResponse.json({ error: 'Workbook not found' }, { status: 404 });
    }

    return new NextResponse(buffer, {
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
