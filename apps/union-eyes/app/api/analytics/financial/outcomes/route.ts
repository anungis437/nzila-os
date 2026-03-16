/**
 * CRUD collection route for analyticsMetrics
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { analyticsMetrics } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: analyticsMetrics,
  pk: 'id',
  tags: ["Analytics"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
