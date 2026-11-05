/**
 * GET /api/federations/[id] — one federation of the register, read only (see the collection route).
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { federations } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET } = crudRoutes({
  table: federations,
  pk: 'id',
  tags: ["Organization"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
});
export { GET };
