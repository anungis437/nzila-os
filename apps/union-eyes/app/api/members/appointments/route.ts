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
  // No screen calls this route, and it has no check that the calendar named is the caller's organization's or not someone's personal
  // calendar, and no server-set organizer: it accepts no field. Events are created through /api/calendar/events.
  writableFields: [],
  writeRole: 'steward',
});
export { GET, POST };
