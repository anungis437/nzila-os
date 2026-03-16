/**
 * CRUD collection route for insightRecommendations
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { insightRecommendations } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: insightRecommendations,
  pk: 'id',
  tags: ["Analytics"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
