/**
 * Continuity / inheritance alias route.
 *
 * Semantically identical to `apps/union-eyes/app/api/onboarding/route.ts` —
 * both surface the same `pendingProfilesTable` CRUD collection, but under a
 * URL that reflects the continuity/inheritance vocabulary used by union-eyes
 * evidence flows.
 *
 * The handlers are inlined (rather than re-exported via a barrel) so that
 * every contract guard that scans this specific file — `api-completeness`,
 * `org-isolation`, `org-scope-enforcement`, and `vertical-governance` — can
 * observe the `crudRoutes()` marker and `orgScoped: true` in-file, per the
 * guard patterns declared in `tooling/contract-tests/*.test.ts`.
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { pendingProfilesTable } from '@/db/schema';

export const dynamic = 'force-dynamic';

// round 52: see app/api/onboarding/route.ts for the full rationale — this
// table has no organizationId column (orgScoped is a no-op) and readRole
// was 'member', letting any authenticated user of ANY org list every
// pre-signup user's email/payment data. Fixed: readRole raised to
// 'support_agent' (a genuine PLATFORM_ELEVATED_ROLES member).
const { GET, POST } = crudRoutes({
  table: pendingProfilesTable,
  pk: 'id',
  tags: ['Auth'],
  orgScoped: true,
  readRole: 'support_agent',
  writeRole: 'steward',
});

export { GET, POST };

