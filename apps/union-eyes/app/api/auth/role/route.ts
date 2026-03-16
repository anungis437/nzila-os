/**
 * CRUD collection route for organizationMembers
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { organizationMembers } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: organizationMembers,
  pk: 'id',
  tags: ["Auth"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'admin',
});
export { GET, POST };
