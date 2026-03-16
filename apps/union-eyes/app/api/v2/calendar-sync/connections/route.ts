/**
 * CRUD collection route for externalCalendarConnections
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { externalCalendarConnections } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: externalCalendarConnections,
  pk: 'id',
  tags: ["Scheduling"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
