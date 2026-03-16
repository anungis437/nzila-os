/**
 * CRUD collection route for calendarEvents
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { calendarEvents } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: calendarEvents,
  pk: 'id',
  tags: ["Scheduling"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
