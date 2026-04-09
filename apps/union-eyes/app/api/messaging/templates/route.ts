/**
 * CRUD collection route for messageTemplates
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { messageTemplates } from '@/db/schema/domains/communications/campaigns';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: messageTemplates,
  pk: 'id',
  tags: ["Communications"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
