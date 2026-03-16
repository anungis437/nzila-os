/**
 * CRUD item route for calendarEvents
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { calendarEvents } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: calendarEvents,
  pk: 'id',
  tags: ["Scheduling"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
