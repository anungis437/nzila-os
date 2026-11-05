/**
 * CRUD item route for message templates
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { messageTemplates } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: messageTemplates,
  pk: 'id',
  tags: ["Communications"],
  orgScoped: true,
  itemRoute: true,
  // A removed template or list is archived, not deleted: a list's subscribed and unsubscribed trail cascades from it, so it is kept.
  archiveColumn: 'isActive',
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
