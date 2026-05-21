/**
 * POST /api/workbook/[id]/claim — Bind a pseudonymous, paid Workbook to a Nzila identity.
 *
 * Single-use bearer token (the `claim_token` stamped by the Stripe webhook).
 * Requires authenticated user. On success the workbook is stamped with the
 * caller's userId + organizationId and the claim token is nulled so it
 * cannot be replayed.
 *
 * Anti-surveillance: this route never reveals the existence of an
 * unclaimed workbook from token shape alone \u2014 generic 404 on miss.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { auth } from '@nzila/platform-auth';
import { db } from '@/db';
import { workbooks } from '@/db/schema/workbook-schema';
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
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workbookId } = await params;

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
        id: workbooks.id,
        claimToken: workbooks.claimToken,
        claimTokenExpiresAt: workbooks.claimTokenExpiresAt,
        claimedAt: workbooks.claimedAt,
        reportTierId: workbooks.reportTierId,
      })
      .from(workbooks)
      .where(and(eq(workbooks.id, workbookId), eq(workbooks.claimToken, claimToken)))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: 'Workbook not found or token invalid' }, { status: 404 });
    }

    if (row.claimedAt) {
      return NextResponse.json({ error: 'Workbook already claimed' }, { status: 409 });
    }

    if (isClaimExpired(row.claimTokenExpiresAt)) {
      return NextResponse.json({ error: 'Claim token expired' }, { status: 410 });
    }

    await db
      .update(workbooks)
      .set({
        claimedByUserId: userId,
        claimedOrgId: orgId,
        claimedAt: new Date(),
        claimToken: null,
        claimTokenExpiresAt: null,
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(workbooks.id, workbookId));

    logger.info('[workbook-claim] Workbook claimed', { workbookId, userId, orgId });

    return NextResponse.json({ ok: true, workbookId, organizationId: orgId });
  } catch (err) {
    logger.error('[workbook-claim] Claim failed', { workbookId, err });
    return NextResponse.json({ error: 'Failed to claim workbook' }, { status: 500 });
  }
}
