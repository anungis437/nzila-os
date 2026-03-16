/**
 * CRUD collection route for perCapitaRemittances
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { perCapitaRemittances } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: perCapitaRemittances,
  pk: 'id',
  tags: ["Billing"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
