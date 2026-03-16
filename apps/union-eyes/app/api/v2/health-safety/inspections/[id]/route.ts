/**
 * CRUD item route for safetyInspections
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { safetyInspections } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: safetyInspections,
  tags: ["Health-safety"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'admin',
});
export { GET, PATCH, DELETE };
