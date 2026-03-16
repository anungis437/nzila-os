/**
 * CRUD collection route for kpiConfigurations
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { kpiConfigurations } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: kpiConfigurations,
  pk: 'id',
  tags: ["Analytics"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
