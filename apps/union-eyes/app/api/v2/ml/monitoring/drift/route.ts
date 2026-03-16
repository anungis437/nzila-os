/**
 * CRUD collection route for mlPredictions
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { mlPredictions } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: mlPredictions,
  pk: 'id',
  tags: ["AI"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
