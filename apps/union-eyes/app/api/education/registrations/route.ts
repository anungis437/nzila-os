/**
 * CRUD collection route for courseRegistrations
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { courseRegistrations } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: courseRegistrations,
  pk: 'id',
  tags: ["Scheduling"],
  orgScoped: true,
  ownerColumn: 'memberId',
  readRole: 'member',
  writeRole: 'member',
});
export { GET, POST };
