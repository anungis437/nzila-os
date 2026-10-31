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
import { checkModuleEntitlement } from '@/services/platform-economics/entitlement-guard';

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
    )
    .limit(200);

  // A client gates features from this list, so it names only what the server-side check would also allow: an expired entitlement
  // or one whose backing contract has ended is not listed.
  const checks = await Promise.all(rows.map(async (r) => ((await checkModuleEntitlement(orgId, r.featureKey)).allowed ? r.featureKey : null)));
  const featureKeys = checks.filter((key): key is string => key !== null);
  return NextResponse.json({ featureKeys });
});
