/**
 * CRUD item route for perCapitaRemittances
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { perCapitaRemittances } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: perCapitaRemittances,
  pk: 'id',
  tags: ["Billing"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
