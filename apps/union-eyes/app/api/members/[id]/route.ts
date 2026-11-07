/**
 * CRUD item route for organizationMembers
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { organizationMembers } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: organizationMembers,
  pk: 'id',
  tags: ["Members"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
  writableFields: ['name', 'email', 'phone', 'department', 'location', 'position', 'hireDate', 'membershipNumber', 'seniority', 'unionJoinDate', 'metadata', 'memberCategory'],
});
export { GET, PATCH, DELETE };
