/**
 * CRUD item route for meetingRooms
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { meetingRooms } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: meetingRooms,
  pk: 'id',
  tags: ["Scheduling"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
