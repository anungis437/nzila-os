/**
 * Entitlements API Route
 *
 * Returns the list of active feature keys for the current user's org.
 * Used by client components (e.g. sidebar) to gate premium features.
 */

import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { orgEntitlements } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { checkModuleEntitlement } from '@/services/platform-economics/entitlement-guard';

// A signed-in user with no organization has no entitlements (an empty list, not an error): the wrapper requires none, and opens the tenant
// transaction (`rlsOrgContext`) only when the caller has an organization. The reads below run in it, as the runtime role with row-level
// security bound to that organization.
export const GET = withApi(
  {
    auth: { required: true },
    requireOrg: false,
    rlsOrgContext: true,
    openapi: { tags: ['Entitlements'], summary: 'Active feature keys of the caller organization' },
  },
  async ({ organizationId }) => {
  if (!organizationId) {
    return NextResponse.json({ featureKeys: [] });
  }

  const rows = await db
    .select({ featureKey: orgEntitlements.featureKey })
    .from(orgEntitlements)
    .where(
      and(
        eq(orgEntitlements.organizationId, organizationId),
        eq(orgEntitlements.status, 'active'),
      ),
    )
    .limit(200);

  // A client gates features from this list, so it names only what the server-side check would also allow: an expired entitlement
  // or one whose backing contract has ended is not listed.
  const checks = await Promise.all(rows.map(async (r) => ((await checkModuleEntitlement(organizationId, r.featureKey)).allowed ? r.featureKey : null)));
  const featureKeys = checks.filter((key): key is string => key !== null);
  return NextResponse.json({ featureKeys });
  },
);
