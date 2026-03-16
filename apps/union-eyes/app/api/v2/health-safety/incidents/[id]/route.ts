/**
 * CRUD item route for workplaceIncidents
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { workplaceIncidents } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: workplaceIncidents,
  tags: ["Health-safety"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'admin',
});
export { GET, PATCH, DELETE };
