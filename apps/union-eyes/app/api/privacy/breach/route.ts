/**
 * CRUD collection route for dataClassificationPolicy
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { dataClassificationPolicy } from '@/db/schema';

export const dynamic = 'force-dynamic';

// round 52: data_classification_policy has no organizationId column, so
// `orgScoped: true` is a no-op here (crud-factory's org filter only
// applies when the table actually has that column) — this is a genuine
// platform-wide policy (Employer Data Firewall doctrine), not per-org
// state. writeRole must be a PLATFORM_ELEVATED_ROLES role (never
// tenant-self-service-assignable, see lib/api-auth-guard.ts) so an
// ordinary org 'admin' cannot mutate platform-wide compliance doctrine —
// matches the round-51 feature_flags fix (withAdminAuth -> withSystemAdminAuth).
const { GET, POST } = crudRoutes({
  table: dataClassificationPolicy,
  pk: 'id',
  tags: ["Compliance"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'compliance_manager',
});
export { GET, POST };
