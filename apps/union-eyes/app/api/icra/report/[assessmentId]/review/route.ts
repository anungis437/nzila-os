/**
 * ARTIFACT TYPE: API Route
 * DOCTRINE_VERSION: 1.0.0
 * CHANGE CLASS: Commercial
 *
 * POST /api/icra/report/[assessmentId]/review
 *
 * Governance review mutation for the deterministic report AI slot.
 * Requires the cron secret and writes an explicit approval/rejection decision
 * into the persisted assessment context so downstream PDF rendering can
 * surface approved AI-assisted narrative only after human review.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { timingSafeEqual } from 'crypto';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { icraAssessments, icraMaturityProfiles } from '@/db/schema/icra-schema';
import { logger } from '@/lib/logger';
import { ALL_QUESTIONS } from '@/lib/icra/questions';
import type { InstitutionalContinuityProfile } from '@/lib/icra/types';
import {
  applyAdaptiveReportReviewDecision,
  embedPersistedAdaptiveReportAISlot,
  extractPersistedAdaptiveReportAISlot,
  resolveAdaptiveReportAISlot,
  type RoutableQuestion,
} from '@/lib/icra/adaptation';
import type { ReviewerRole } from '@/lib/icra/adaptation';

interface RouteContext {
  params: Promise<{ assessmentId: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function authorize(request: Request): boolean {
  const header = request.headers.get('x-cron-secret') ?? request.headers.get('authorization')?.replace('Bearer ', '') ?? '';
  const expected = process.env.CRON_SECRET_KEY ?? process.env.CRON_SECRET ?? '';
  if (!expected) return false;
  const actualBuf = Buffer.from(header);
  const expectedBuf = Buffer.from(expected);
  return actualBuf.length === expectedBuf.length && timingSafeEqual(actualBuf, expectedBuf);
}

function normalizeReviewerRole(role: unknown): ReviewerRole {
  return role === 'governance_reviewer' || role === 'exec_sponsor' ? role : 'facilitator';
}

export async function POST(request: Request, { params }: RouteContext) {
  const { assessmentId } = await params;

  if (!assessmentId || !UUID_RE.test(assessmentId)) {
    return NextResponse.json({ error: 'Invalid assessment ID.' }, { status: 400 });
  }

  if (!authorize(request)) {
    return NextResponse.json({ error: 'Invalid cron secret.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = body as {
    action?: unknown;
    summary?: unknown;
    reviewerRole?: unknown;
  };

  if (parsed.action !== 'approve' && parsed.action !== 'reject') {
    return NextResponse.json({ error: 'Invalid review action.' }, { status: 400 });
  }
  if (typeof parsed.summary !== 'string' || !parsed.summary.trim()) {
    return NextResponse.json({ error: 'Review summary is required.' }, { status: 400 });
  }

  try {
    const [assessment] = await db
      .select({
        id: icraAssessments.id,
        organizationContext: icraAssessments.organizationContext,
        locale: icraAssessments.locale,
      })
      .from(icraAssessments)
      .where(eq(icraAssessments.id, assessmentId))
      .limit(1);

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 });
    }

    const [profileRow] = await db
      .select({ profilePayload: icraMaturityProfiles.profilePayload })
      .from(icraMaturityProfiles)
      .where(eq(icraMaturityProfiles.assessmentId, assessmentId))
      .limit(1);

    if (!profileRow?.profilePayload) {
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
    }

    const profile = profileRow.profilePayload as InstitutionalContinuityProfile;
    const locale = assessment.locale === 'fr-CA' ? 'fr-CA' : 'en-CA';

    const slot =
      extractPersistedAdaptiveReportAISlot(assessment.organizationContext) ??
      resolveAdaptiveReportAISlot({
        rawProfile: profile,
        organizationContext: assessment.organizationContext,
        questionBank: ALL_QUESTIONS as unknown as readonly RoutableQuestion[],
        locale,
        generatedAt: profile.generatedAt,
      });

    if (!slot) {
      return NextResponse.json({ error: 'Report AI slot could not be resolved.' }, { status: 422 });
    }

    const updated = applyAdaptiveReportReviewDecision(slot, {
      reviewerRole: normalizeReviewerRole(parsed.reviewerRole),
      status: parsed.action === 'approve' ? 'approved' : 'rejected',
      summary: parsed.summary.trim(),
      reviewedAt: new Date().toISOString(),
    });

    const updatedOrganizationContext = embedPersistedAdaptiveReportAISlot(
      assessment.organizationContext as Record<string, unknown> | null,
      updated,
    );

    await db
      .update(icraAssessments)
      .set({ organizationContext: updatedOrganizationContext })
      .where(eq(icraAssessments.id, assessmentId));

    logger.info('icra.report.review_recorded', {
      assessmentId,
      action: parsed.action,
    });

    return NextResponse.json(
      {
        success: true,
        assessmentId,
        action: parsed.action,
        reviewStatus: updated.reviewWorkflow.status,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error('icra.report.review_failed', {
      assessmentId,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'Review update failed.' }, { status: 500 });
  }
}