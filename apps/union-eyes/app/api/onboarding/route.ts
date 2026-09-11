/**
 * CRUD collection route for pendingProfilesTable
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { pendingProfilesTable } from '@/db/schema';

export const dynamic = 'force-dynamic';

// round 52: pendingProfilesTable has no organizationId column (it is a
// pre-signup identity anchor keyed by email, before any org membership
// exists), so orgScoped is a no-op here. readRole was 'member' — any
// authenticated user of ANY organization could list every pre-signup
// user's email, Whop membership id, and billing-cycle data via GET. Fixed:
// readRole raised to 'support_agent' (a genuine PLATFORM_ELEVATED_ROLES
// member, see lib/api-auth-guard.ts), matching the round-51/52
// feature_flags/data_classification_policy precedent — ordinary tenant
// members have no legitimate reason to browse this table.
const { GET, POST } = crudRoutes({
  table: pendingProfilesTable,
  pk: 'id',
  tags: ["Auth"],
  orgScoped: true,
  readRole: 'support_agent',
  writeRole: 'steward',
});
export { GET, POST };
