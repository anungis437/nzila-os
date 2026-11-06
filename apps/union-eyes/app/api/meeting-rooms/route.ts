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
  // No screen creates a room. A room's description; its status, active flag, booking rules, allowed roles and contact person are not set here.
  writableFields: ['name', 'displayName', 'description', 'buildingName', 'floor', 'roomNumber', 'address', 'capacity', 'features', 'equipment'],
  writeRole: 'steward',
});
export { GET, POST };
