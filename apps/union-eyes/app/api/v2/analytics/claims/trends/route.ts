/**
 * CRUD collection route for trendAnalyses
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { trendAnalyses } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: trendAnalyses,
  pk: 'id',
  tags: ["Analytics"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
