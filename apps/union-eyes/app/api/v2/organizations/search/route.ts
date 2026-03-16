/**
 * CRUD collection route for organizations
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { organizations } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: organizations,
  pk: 'id',
  tags: ["Organizations"],
  orgScoped: false,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
