/**
 * POST /api/pilot/apply/[id]/approve-commercial-terms
 *
 * Platform-only approval of a pilot application's commercial terms (PR
 * #752 round 25). Before this endpoint existed, commercial-transition
 * derived real contract/invoice amounts from applicant-supplied
 * `memberCount` and selected a subscription plan via an ambiguous
 * "any active plan" fallback. This is the ONLY endpoint that may set the
 * server-controlled `verifiedMemberCount`/`verifiedPilotAmount`/
 * `verifiedSubscriptionPlanId`/`commercialTermsApprovedBy`/
 * `commercialTermsApprovedAt` fields that commercial-transition now
 * requires before any financial-artifact-creating transition.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { withApiAuth, hasMinRole, getCurrentUser } from '@/lib/api-auth-guard';
import { approveCommercialTerms } from '@/lib/pilot/commercial-terms-authority';

export const dynamic = 'force-dynamic';

const approveCommercialTermsBodySchema = z.object({
  memberCount: z.number().int().positive(),
  subscriptionPlanId: z.string().uuid().optional().nullable(),
  pilotAmount: z.union([z.string(), z.number()]).optional().nullable(),
});

export const POST = withApiAuth(async (request: NextRequest, context?: { params?: Promise<{ id: string }> | { id: string } }) => {
  // Platform-only, before any database access — this endpoint is the ONE
  // place these commercial-terms fields may be set; no same-org
  // self-service path exists (an applicant's own member count cannot
  // approve itself).
  if (!(await hasMinRole('system_admin'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rawParams = context?.params ? await context.params : undefined;
  const pilotId = rawParams?.id;
  if (!pilotId) {
    return NextResponse.json({ error: 'Pilot application id is required' }, { status: 400 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = approveCommercialTermsBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'A valid memberCount is required', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pilotAmount = parsed.data.pilotAmount != null ? String(parsed.data.pilotAmount) : null;

  const result = await approveCommercialTerms({
    pilotId,
    approvedBy: user.id,
    memberCount: parsed.data.memberCount,
    subscriptionPlanId: parsed.data.subscriptionPlanId ?? null,
    pilotAmount,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    verifiedMemberCount: result.verifiedMemberCount,
    verifiedPilotAmount: result.verifiedPilotAmount,
    verifiedSubscriptionPlanId: result.verifiedSubscriptionPlanId,
  });
});
