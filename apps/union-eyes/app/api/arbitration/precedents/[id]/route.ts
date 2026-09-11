/**
 * CRUD item route for arbitrationDecisions
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { arbitrationDecisions } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: arbitrationDecisions,
  pk: 'id',
  tags: ["Bargaining"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  // arbitration_decisions is shared, cross-tenant reference data (no org
  // discriminator - orgScoped is a no-op here). writeRole must therefore be
  // a genuine platform-elevated role, never an ordinary per-tenant role
  // (round 58D fix; same defect class round 52 fixed for dataClassificationPolicy).
  writeRole: 'content_manager',
});
export { GET, PATCH, DELETE };
