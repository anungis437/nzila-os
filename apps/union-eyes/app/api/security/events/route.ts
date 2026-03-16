/**
 * CRUD collection route for securityEvents
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { securityEvents } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: securityEvents,
  pk: 'id',
  tags: ["System"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
