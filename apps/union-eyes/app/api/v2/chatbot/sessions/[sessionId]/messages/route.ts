/**
 * CRUD collection route for chatSessions
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { chatSessions } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: chatSessions,
  pk: 'id',
  tags: ["AI"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
