/**
 * CRUD collection route for dataClassificationPolicy
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { dataClassificationPolicy } from '@/db/schema';

export const dynamic = 'force-dynamic';

// round 52: see app/api/privacy/breach/route.ts for the full rationale —
// this table has no organizationId column (orgScoped is a no-op) and is
// genuine platform-wide policy; writeRole must be a PLATFORM_ELEVATED_ROLES
// role so an ordinary org 'admin' cannot mutate it.
const { GET, POST } = crudRoutes({
  table: dataClassificationPolicy,
  pk: 'id',
  tags: ["Compliance"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'compliance_manager',
});
export { GET, POST };
