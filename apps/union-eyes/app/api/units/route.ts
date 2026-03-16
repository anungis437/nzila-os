/**
 * CRUD collection route for bargainingUnits
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { bargainingUnits } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: bargainingUnits,
  pk: 'id',
  tags: ["Organization"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
