/**
 * CRUD collection route for calendars
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { calendars } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: calendars,
  pk: 'id',
  tags: ["Scheduling"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
