/**
 * CRUD collection route for courseRegistrations (completed only)
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
  writeRole: 'steward',
});
export { GET, POST };
