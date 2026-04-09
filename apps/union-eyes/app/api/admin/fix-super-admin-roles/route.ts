/**
 * CRUD collection route for organizationMembers — super-admin role fix
 * Restricted to system_admin+ role only.
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { organizationMembers } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: organizationMembers,
  pk: 'id',
  tags: ["Members"],
  orgScoped: true,
  readRole: 'admin',
  writeRole: 'admin',
});
export { GET, POST };
