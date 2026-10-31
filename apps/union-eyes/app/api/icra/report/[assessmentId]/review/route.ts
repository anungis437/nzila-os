/**
 * ARTIFACT TYPE: API Route
 * DOCTRINE_VERSION: 1.0.0
 * CHANGE CLASS: Commercial
 *
 * POST /api/icra/report/[assessmentId]/review
 *
 * Governance review mutation for the deterministic report AI slot.
 * Requires an authenticated platform administrator (a person, not a shared secret) and writes an explicit approval/rejection
 * decision into the persisted assessment context so downstream PDF rendering can surface approved AI-assisted narrative only
 * after human review. The reviewer role is derived from that verified authority, never taken from the request body, and the
 * audit actor is the reviewer's own identity.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { auth } from '@nzila/platform-auth/entra/server';
import { requireSystemAdmin } from '@/lib/api-auth-guard';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { icraAssessments, icraMaturityProfiles } from '@/db/schema/icra-schema';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { getOrganizationIdForUser } from '@/lib/organization-utils';
import { logger } from '@/lib/logger';
import { ALL_QUESTIONS } from '@/lib/icra/questions';
import type { OrganizationalContinuityProfile } from '@/lib/icra/types';
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

/** A platform administrator reviews as the governance reviewer: that is the authority they hold. The body cannot claim another. */
const VERIFIED_REVIEWER_ROLE: ReviewerRole = 'governance_reviewer';

export async function POST(request: Request, { params }: RouteContext) {
  const { assessmentId } = await params;

  if (!assessmentId || !UUID_RE.test(assessmentId)) {
    return NextResponse.json({ error: 'Invalid assessment ID.' }, { status: 400 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  try {
    await requireSystemAdmin();
  } catch {
    return NextResponse.json({ error: 'Report review requires platform governance authority.' }, { status: 403 });
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

  // A role named in the body is only ever a claim; it is accepted when it matches the verified authority and refused otherwise.
  if (parsed.reviewerRole !== undefined && parsed.reviewerRole !== VERIFIED_REVIEWER_ROLE) {
    return NextResponse.json({ error: 'reviewerRole is derived from verified authority and cannot be asserted.' }, { status: 403 });
  }
  if (parsed.action !== 'approve' && parsed.action !== 'reject') {
    return NextResponse.json({ error: 'Invalid review action.' }, { status: 400 });
  }
  if (typeof parsed.summary !== 'string' || !parsed.summary.trim()) {
    return NextResponse.json({ error: 'Review summary is required.' }, { status: 400 });
  }
  const summary = parsed.summary.trim();
  const action = parsed.action;

  try {
    return await withSystemContext(async (tx) => {
    const [assessment] = await tx
      .select({
        id: icraAssessments.id,
        organizationContext: icraAssessments.organizationContext,
        locale: icraAssessments.locale,
        claimedOrgId: icraAssessments.claimedOrgId,
      })
      .from(icraAssessments)
      .where(eq(icraAssessments.id, assessmentId))
      .limit(1);

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 });
    }

    const [profileRow] = await tx
      .select({ profilePayload: icraMaturityProfiles.profilePayload })
      .from(icraMaturityProfiles)
      .where(eq(icraMaturityProfiles.assessmentId, assessmentId))
      .limit(1);

    if (!profileRow?.profilePayload) {
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
    }

    const profile = profileRow.profilePayload as OrganizationalContinuityProfile;
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

    // Every review decision is audited. The audit chain is organization-keyed: a claimed assessment is audited against the organization
    // that claimed it, and an unclaimed prospect assessment against the organization the reviewing platform administrator is acting in
    // (as for any platform operation). A reviewer acting in no organization cannot record a decision, so none is made unrecorded.
    const auditOrganizationId = assessment.claimedOrgId ?? (await getOrganizationIdForUser(userId).catch(() => null));
    if (!auditOrganizationId) {
      return NextResponse.json(
        { error: 'A review decision needs an acting organization to be recorded against. Select an organization and retry.' },
        { status: 409 },
      );
    }

    const updated = applyAdaptiveReportReviewDecision(slot, {
      reviewerRole: VERIFIED_REVIEWER_ROLE,
      status: action === 'approve' ? 'approved' : 'rejected',
      summary,
      reviewedAt: new Date().toISOString(),
    });

    const updatedOrganizationContext = embedPersistedAdaptiveReportAISlot(
      assessment.organizationContext as Record<string, unknown> | null,
      updated,
    );

    await tx
      .update(icraAssessments)
      .set({ organizationContext: updatedOrganizationContext })
      .where(eq(icraAssessments.id, assessmentId));

    // The decision is stored in the assessment row above and its audit record is written in the same transaction, so the decision
    // cannot commit without it. The summary text is the reviewer's own words and is not copied into the audit record.
    await persistAtomicAudit(tx, {
      organizationId: auditOrganizationId,
      userId,
      action: 'icra.report.review',
      resourceType: 'icra_assessments',
      resourceId: assessmentId,
      details: {
        decision: action,
        reviewerRole: VERIFIED_REVIEWER_ROLE,
        reviewStatus: updated.reviewWorkflow.status,
        assessmentClaimed: Boolean(assessment.claimedOrgId),
      },
    });

    logger.info('icra.report.review_recorded', {
      assessmentId,
      action,
      reviewerUserId: userId,
    });

    return NextResponse.json(
      {
        success: true,
        assessmentId,
        action,
        reviewStatus: updated.reviewWorkflow.status,
      },
      { status: 200 },
    );
    });
  } catch (error) {
    logger.error('icra.report.review_failed', {
      assessmentId,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'Review update failed.' }, { status: 500 });
  }
}