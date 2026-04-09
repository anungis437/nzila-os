/**
 * CRUD collection route for organizationMembers — role management
 * Requires admin+ role (not steward) for writes since this controls role assignment.
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { organizationMembers } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: organizationMembers,
  pk: 'id',
  tags: ["Members"],
  orgScoped: true,
  readRole: 'steward',
  writeRole: 'admin',
});
export { GET, POST };
