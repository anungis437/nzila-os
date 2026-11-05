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
import { icraAssessments, icraMaturityProfiles } from '@/db/schema/icra-schema';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { guardPublicIntake } from '@/lib/public-intake/guard';
import {
  capabilityDenialStatus,
} from '@/lib/icra/assessment-capability';
import { authorizeAssessmentAccess } from '@/lib/icra/assessment-access';
import type { InstitutionalContinuityProfile, OrganizationContext } from '@/lib/icra/types';
import { mapCtxToOrganizationContext } from '@/lib/icra/org-context-mapper';
import { mapToPdfReportData } from '@/lib/icra-pdf/reportDataMapper';
import { generateExecutiveContinuityPdf } from '@/lib/icra-pdf/generateExecutiveContinuityPdf';
import { logger } from '@/lib/logger';

const PDF_ELIGIBLE_TIERS = new Set([
  'executive_continuity_brief',
  'institutional_continuity_diagnostic',
]);

const REPORTABLE_STATUSES = new Set(['submitted', 'completed']);

interface RouteContext {
  params: Promise<{ assessmentId: string }>;
}

export async function GET(request: Request, { params }: RouteContext) {
  // A capability read is bounded like the writes: a caller cannot probe assessment ids or render reports without limit.
  const intake = await guardPublicIntake(request, { bucket: 'capability', readBody: false })
  if (!intake.ok) return intake.response
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
    return await withSystemContext(async (tx) => {
    // Fetch assessment (tier gate + org context)
    const [assessment] = await tx
      .select({
        id: icraAssessments.id,
        status: icraAssessments.status,
        reportTierId: icraAssessments.reportTierId,
        organizationContext: icraAssessments.organizationContext,
        capabilityTokenHash: icraAssessments.capabilityTokenHash,
        capabilityTokenExpiresAt: icraAssessments.capabilityTokenExpiresAt,
        claimedAt: icraAssessments.claimedAt,
        claimedOrgId: icraAssessments.claimedOrgId,
        claimedByUserId: icraAssessments.claimedByUserId,
      })
      .from(icraAssessments)
      .where(eq(icraAssessments.id, assessmentId))
      .limit(1);

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    const capCheck = await authorizeAssessmentAccess(request, assessmentId, assessment);
    if (!capCheck.ok) {
      return NextResponse.json(
        { error: 'Not authorized to download this report' },
        { status: capabilityDenialStatus(capCheck.reason) },
      );
    }

    // The submit routes write submitted; nothing in the application writes completed, so gating on it refused every
    // paid assessment. A submitted assessment is the finished one the report is built from.
    if (!REPORTABLE_STATUSES.has(assessment.status)) {
      return NextResponse.json({ error: 'Assessment not yet submitted' }, { status: 422 });
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
    const [profileRow] = await tx
      .select({ profilePayload: icraMaturityProfiles.profilePayload })
      .from(icraMaturityProfiles)
      .where(eq(icraMaturityProfiles.assessmentId, assessmentId))
      .orderBy(icraMaturityProfiles.generatedAt)
      .limit(1);

    if (!profileRow) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const profile = profileRow.profilePayload as any as InstitutionalContinuityProfile;
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
