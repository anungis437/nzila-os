/**
 * POST /api/pilot/apply/[id]/rebind-organization
 *
 * Platform-only CORRECTION of an already-verified pilot application's bound
 * organization (PR #752 round 21). `bindPilotOrganization()` (used by
 * .../verify-organization) is immutable once set — it accepts a repeat call
 * for the SAME organization (idempotent) but rejects a different one with
 * 409. This endpoint is the deliberate exception: it requires an explicit
 * `reason`, refuses to proceed if real financial artifacts already exist
 * for this pilot unless the caller explicitly acknowledges that those
 * artifacts are not being migrated automatically, and is logged
 * (`logger.warn`) for traceability — see `rebindPilotOrganization()`'s doc
 * comment for the current limits of that logging (structured log only, not
 * yet a durable `audit_logs` row).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { withApiAuth, hasMinRole, getCurrentUser } from '@/lib/api-auth-guard';
import { rebindPilotOrganization } from '@/lib/pilot/pilot-ownership';

export const dynamic = 'force-dynamic';

const rebindOrganizationBodySchema = z.object({
  organizationId: z.string().uuid(),
  reason: z.string().trim().min(10, 'A reason of at least 10 characters is required to rebind a verified organization'),
  acknowledgeFinancialArtifacts: z.boolean().optional(),
});

export const POST = withApiAuth(async (request: NextRequest, context?: { params?: Promise<{ id: string }> | { id: string } }) => {
  // Platform-only, before any database access — same gate as
  // verify-organization; rebinding is strictly MORE sensitive, never less.
  if (!(await hasMinRole('system_admin'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rawParams = context?.params ? await context.params : undefined;
  const pilotId = rawParams?.id;
  if (!pilotId) {
    return NextResponse.json({ error: 'Pilot application id is required' }, { status: 400 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = rebindOrganizationBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'A valid organizationId and reason are required', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await rebindPilotOrganization({
    pilotId,
    organizationId: parsed.data.organizationId,
    verifiedBy: user.id,
    reason: parsed.data.reason,
    acknowledgeFinancialArtifacts: parsed.data.acknowledgeFinancialArtifacts,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    organizationId: result.organizationId,
    previousOrganizationId: result.previousOrganizationId,
  });
});
