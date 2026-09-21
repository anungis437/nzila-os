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
import { and, eq, gt, isNull } from 'drizzle-orm';
import { auth } from '@nzila/platform-auth/entra/server';
import { workbooks } from '@/db/schema/workbook-schema';
import { getOrganizationIdForUser } from '@/lib/organization-utils';
import { withSystemContext } from '@/lib/db/with-rls-context';
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

  let body: any;
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
    const result = await withSystemContext(async (tx) => {
      const claimedAt = new Date();
      const [claimed] = await tx
        .update(workbooks)
        .set({
          claimedByUserId: userId,
          claimedOrgId: orgId,
          claimedAt,
          claimToken: null,
          claimTokenExpiresAt: null,
          status: 'active',
          updatedAt: claimedAt,
        })
        .where(
          and(
            eq(workbooks.id, workbookId),
            eq(workbooks.claimToken, claimToken),
            isNull(workbooks.claimedAt),
            gt(workbooks.claimTokenExpiresAt, claimedAt),
          ),
        )
        .returning({ id: workbooks.id });

      if (claimed) {
        return { status: 'claimed' as const };
      }

      const [row] = await tx
        .select({
          claimedAt: workbooks.claimedAt,
          claimTokenExpiresAt: workbooks.claimTokenExpiresAt,
        })
        .from(workbooks)
        .where(and(eq(workbooks.id, workbookId), eq(workbooks.claimToken, claimToken)))
        .limit(1);

      if (!row) return { status: 'not_found' as const };
      if (row.claimedAt) return { status: 'already_claimed' as const };
      return { status: 'expired' as const };
    });

    if (result.status === 'not_found') {
      return NextResponse.json({ error: 'Workbook not found or token invalid' }, { status: 404 });
    }
    if (result.status === 'already_claimed') {
      return NextResponse.json({ error: 'Workbook already claimed' }, { status: 409 });
    }
    if (result.status === 'expired') {
      return NextResponse.json({ error: 'Claim token expired' }, { status: 410 });
    }

    logger.info('[workbook-claim] Workbook claimed', { workbookId, userId, orgId });

    return NextResponse.json({ ok: true, workbookId, organizationId: orgId });
  } catch (err) {
    logger.error('[workbook-claim] Claim failed', { workbookId, err });
    return NextResponse.json({ error: 'Failed to claim workbook' }, { status: 500 });
  }
}
