/**
 * CRUD item route for messageTemplates
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { messageTemplates } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: messageTemplates,
  pk: 'id',
  tags: ["Notifications"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
