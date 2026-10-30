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
  readRole: 'health_safety_rep',
  writeRole: 'admin',
});
export { GET, PATCH, DELETE };
