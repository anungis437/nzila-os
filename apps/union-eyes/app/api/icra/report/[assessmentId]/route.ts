/**
 * ARTIFACT TYPE: API Route
 * DOCTRINE_VERSION: 1.0.0
 * CHANGE CLASS: Commercial
 *
 * GET /api/icra/report/[assessmentId]
 *
 * Serves the Leadership Briefing Report as a PDF download.
 *
 * Pseudonymous by design — no auth required, gated by tier check.
 * Only assessments with reportTierId = 'executive_continuity_brief' or
 * 'institutional_continuity_diagnostic' may download a PDF.
 *
 * Must run in Node.js runtime (react-pdf uses native modules).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { icraAssessments, icraMaturityProfiles } from '@/db/schema/icra-schema';
import type { InstitutionalContinuityProfile, OrganizationContext } from '@/lib/icra/types';
import { mapCtxToOrganizationContext } from '@/lib/icra/org-context-mapper';
import { mapToPdfReportData } from '@/lib/icra-pdf/reportDataMapper';
import { generateExecutiveContinuityPdf } from '@/lib/icra-pdf/generateExecutiveContinuityPdf';
import { logger } from '@/lib/logger';

const PDF_ELIGIBLE_TIERS = new Set([
  'executive_continuity_brief',
  'institutional_continuity_diagnostic',
]);

interface RouteContext {
  params: Promise<{ assessmentId: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { assessmentId } = await params;

  if (!assessmentId || typeof assessmentId !== 'string') {
    return NextResponse.json({ error: 'Missing assessment ID' }, { status: 400 });
  }

  // Validate UUID-shape to short-circuit obviously malformed requests before DB roundtrip
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(assessmentId)) {
    return NextResponse.json({ error: 'Invalid assessment ID' }, { status: 400 });
  }

  try {
    // Fetch assessment (tier gate + org context)
    const [assessment] = await db
      .select({
        id: icraAssessments.id,
        status: icraAssessments.status,
        reportTierId: icraAssessments.reportTierId,
        organizationContext: icraAssessments.organizationContext,
      })
      .from(icraAssessments)
      .where(eq(icraAssessments.id, assessmentId))
      .limit(1);

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    if (assessment.status !== 'completed') {
      return NextResponse.json({ error: 'Assessment not yet completed' }, { status: 422 });
    }

    if (!PDF_ELIGIBLE_TIERS.has(assessment.reportTierId)) {
      return NextResponse.json(
        {
          error: 'Report tier does not include PDF access',
          tier: assessment.reportTierId,
        },
        { status: 403 },
      );
    }

    // Fetch profile payload
    const [profileRow] = await db
      .select({ profilePayload: icraMaturityProfiles.profilePayload })
      .from(icraMaturityProfiles)
      .where(eq(icraMaturityProfiles.assessmentId, assessmentId))
      .orderBy(icraMaturityProfiles.generatedAt)
      .limit(1);

    if (!profileRow) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const profile = profileRow.profilePayload as unknown as InstitutionalContinuityProfile;
    const orgContext = mapCtxToOrganizationContext(
      assessment.organizationContext as Record<string, unknown> | OrganizationContext | null,
    );

    // Defensive: profile must have minimum required shape to render safely
    if (!profile?.dimensions || !profile?.maturityBand) {
      return NextResponse.json(
        { error: 'Profile is incomplete and cannot be rendered' },
        { status: 422 },
      );
    }

    const reportData = mapToPdfReportData(profile, orgContext);
    const pdfBuffer = await generateExecutiveContinuityPdf(reportData);

    const date = reportData.generatedAt.toISOString().slice(0, 10);
    const filename = `executive-continuity-brief-${date}.pdf`;

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  } catch (error) {
    // Log server-side; do not leak stack or internal details to client.
    logger.error('[icra-pdf] render failed', {
      assessmentId,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(
      { error: 'Report generation failed. Please try again or contact support.' },
      { status: 500 },
    );
  }
}
