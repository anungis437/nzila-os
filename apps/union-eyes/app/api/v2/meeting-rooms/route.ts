/**
 * CRUD collection route for meetingRooms
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { meetingRooms } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: meetingRooms,
  pk: 'id',
  tags: ["Scheduling"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
