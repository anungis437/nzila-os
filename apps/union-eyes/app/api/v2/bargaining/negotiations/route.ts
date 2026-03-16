/**
 * CRUD collection route for negotiations
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { negotiations } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: negotiations,
  pk: 'id',
  tags: ["Bargaining"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
