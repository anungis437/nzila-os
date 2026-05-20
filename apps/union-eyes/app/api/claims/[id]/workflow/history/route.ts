/**
 * GET /api/claims/[id]/workflow/history
 * Returns workflow transition history for a claim
 * Drizzle ORM — direct database access (migrated from Django proxy)
 */
import { NextRequest, NextResponse } from 'next/server';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { grievanceTransitions } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/api-auth-guard';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!user.organizationId) {
    return NextResponse.json({ error: 'Organization context required' }, { status: 403 });
  }

  const { id } = await params;
  const orgId = user.organizationId; // narrowed to string by guard above
  const history = await withRLSContext(async (tx) =>
    tx
      .select()
      .from(grievanceTransitions)
      .where(
        and(
          eq(grievanceTransitions.claimId, id),
          eq(grievanceTransitions.organizationId, orgId),
        )
      )
      .orderBy(desc(grievanceTransitions.transitionedAt))
  );
  return NextResponse.json(history);
}