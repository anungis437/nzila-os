/**
 * CRUD item route for userConsents
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { userConsents } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: userConsents,
  pk: 'id',
  tags: ["Auth"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
