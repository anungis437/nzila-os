/**
 * Entitlements API Route
 *
 * Returns the list of active feature keys for the current user's org.
 * Used by client components (e.g. sidebar) to gate premium features.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth, BaseAuthContext, getCurrentUser } from '@/lib/api-auth-guard';
import { db } from '@/db/db';
import { orgEntitlements } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const GET = withApiAuth(async (_request: NextRequest, _context: BaseAuthContext) => {
  const user = await getCurrentUser();
  const orgId = user?.organizationId;
  if (!orgId) {
    return NextResponse.json({ featureKeys: [] });
  }

  const rows = await db
    .select({ featureKey: orgEntitlements.featureKey })
    .from(orgEntitlements)
    .where(
      and(
        eq(orgEntitlements.organizationId, orgId),
        eq(orgEntitlements.status, 'active'),
      ),
    );

  const featureKeys = rows.map(r => r.featureKey);
  return NextResponse.json({ featureKeys });
});
