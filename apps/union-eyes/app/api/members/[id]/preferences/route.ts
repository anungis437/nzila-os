/**
 * CRUD item route for communicationPreferences
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { communicationPreferences } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: communicationPreferences,
  pk: 'id',
  tags: ["Auth"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
