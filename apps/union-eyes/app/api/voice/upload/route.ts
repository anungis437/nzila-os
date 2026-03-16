/**
 * CRUD collection route for knowledgeBase
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { knowledgeBase } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: knowledgeBase,
  pk: 'id',
  tags: ["AI"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
