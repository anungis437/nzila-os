/**
 * POST /api/pilot/apply/[id]/verify-organization
 *
 * Platform-only binding of a pilot application to a verified organization
 * (PR #752 round 20). `responses.organizationId` is an unauthenticated
 * client claim; this is the ONLY endpoint that may set the server-
 * controlled `verifiedOrganizationId`/`verifiedBy`/`verifiedAt` fields that
 * commercial-transition and any future RLS policy must use instead.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { withApiAuth, hasMinRole, getCurrentUser } from '@/lib/api-auth-guard';
import { bindPilotOrganization } from '@/lib/pilot/pilot-ownership';

export const dynamic = 'force-dynamic';

const verifyOrganizationBodySchema = z.object({
  organizationId: z.string().uuid(),
});

export const POST = withApiAuth(async (request: NextRequest, context?: { params?: Promise<{ id: string }> | { id: string } }) => {
  // Platform-only, before any database access — this endpoint is the ONE
  // place `verifiedOrganizationId` may be set; no same-org self-service path
  // exists (a submitter's own claim cannot verify itself).
  if (!(await hasMinRole('system_admin'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rawParams = context?.params ? await context.params : undefined;
  const pilotId = rawParams?.id;
  if (!pilotId) {
    return NextResponse.json({ error: 'Pilot application id is required' }, { status: 400 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = verifyOrganizationBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'A valid organizationId is required', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await bindPilotOrganization({
    pilotId,
    organizationId: parsed.data.organizationId,
    verifiedBy: user.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, verifiedOrganizationId: result.organizationId });
});
