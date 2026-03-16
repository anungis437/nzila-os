/**
 * CRUD item route for calendars
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { calendars } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: calendars,
  pk: 'id',
  tags: ["Scheduling"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
