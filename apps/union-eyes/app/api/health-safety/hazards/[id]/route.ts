/**
 * CRUD item route for hazardReports
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { hazardReports } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: hazardReports,
  tags: ["Health-safety"],
  orgScoped: true,
  itemRoute: true,
  // Sensitive hazard detail cannot be readable below the collection's H&S floor.
  // This is a containment measure; case-specific grants and read auditing
  // remain separate Gate 0 obligations and are NOT certified by this change.
  readRole: 'health_safety_rep',
  writeRole: 'admin',
});
export { GET, PATCH, DELETE };
