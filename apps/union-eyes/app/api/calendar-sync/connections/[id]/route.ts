/**
 * CRUD item route for externalCalendarConnections
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { externalCalendarConnections } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: externalCalendarConnections,
  pk: 'id',
  tags: ["Scheduling"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
