/**
 * CRUD collection route for securityEvents
 *
 * PR #752 round 49: readRole/writeRole tightened from the crud-factory
 * defaults (member/steward) to security_manager, matching the privileged
 * gate app/[locale]/dashboard/security/page.tsx already enforces via
 * hasMinRole('security_manager'). Previously any org 'member' could read
 * every security event for their organization directly via this API
 * (bypassing the dashboard's intended privileged-reader restriction), and
 * any 'steward' could fabricate arbitrary security event records
 * (attacker-controlled severity/type/description) — a self-authored
 * security-evidence integrity defect.
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { securityEvents } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: securityEvents,
  pk: 'eventId',
  tags: ["System"],
  orgScoped: true,
  readRole: 'security_manager',
  writeRole: 'security_manager',
});
export { GET, POST };
