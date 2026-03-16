/**
 * CRUD collection route for workplaceIncidents
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { workplaceIncidents } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: workplaceIncidents,
  tags: ["Health-safety"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'admin',
});
export { GET, POST };
