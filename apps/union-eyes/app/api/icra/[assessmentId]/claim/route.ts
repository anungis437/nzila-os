/**
 * POST /api/icra/[assessmentId]/claim — Bind a pseudonymous, paid ICRA assessment to a Nzila identity.
 *
 * Mirrors POST /api/workbook/[id]/claim. Self-serve ICRA Brief and
 * Diagnostic tiers use the same opaque claim-token mechanism.
 *
 * Single-use bearer token (the `claim_token` stamped by the Stripe webhook
 * on paid ICRA tier upgrade \u2014 token issuance for ICRA is wired separately
 * in the webhook ICRA branch when claim-on-purchase is enabled).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { auth } from '@nzila/platform-auth/entra/server';
import { db } from '@/db';
import { icraAssessments } from '@/db/schema/icra-schema';
import { getOrganizationIdForUser } from '@/lib/organization-utils';
import { isClaimExpired } from '@/lib/icra/claim-tokens';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({
  claimToken: z.string().min(16, 'Invalid claim token'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const { assessmentId } = await params;

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parse = bodySchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parse.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const { claimToken } = parse.data;

  const orgId = await getOrganizationIdForUser(userId).catch(() => null);
  if (!orgId) {
    return NextResponse.json(
      { error: 'No organization context for the current user' },
      { status: 403 },
    );
  }

  try {
    const [row] = await db
      .select({
        id: icraAssessments.id,
        claimToken: icraAssessments.claimToken,
        claimTokenExpiresAt: icraAssessments.claimTokenExpiresAt,
        claimedAt: icraAssessments.claimedAt,
      })
      .from(icraAssessments)
      .where(
        and(eq(icraAssessments.id, assessmentId), eq(icraAssessments.claimToken, claimToken)),
      )
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: 'Assessment not found or token invalid' }, { status: 404 });
    }

    if (row.claimedAt) {
      return NextResponse.json({ error: 'Assessment already claimed' }, { status: 409 });
    }

    if (isClaimExpired(row.claimTokenExpiresAt)) {
      return NextResponse.json({ error: 'Claim token expired' }, { status: 410 });
    }

    await db
      .update(icraAssessments)
      .set({
        claimedByUserId: userId,
        claimedOrgId: orgId,
        claimedAt: new Date(),
        claimToken: null,
        claimTokenExpiresAt: null,
      })
      .where(eq(icraAssessments.id, assessmentId));

    logger.info('[icra-claim] Assessment claimed', { assessmentId, userId, orgId });

    return NextResponse.json({ ok: true, assessmentId, organizationId: orgId });
  } catch (err) {
    logger.error('[icra-claim] Claim failed', { assessmentId, err });
    return NextResponse.json({ error: 'Failed to claim assessment' }, { status: 500 });
  }
}
