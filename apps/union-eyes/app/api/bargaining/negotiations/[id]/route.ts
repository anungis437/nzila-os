/**
 * CRUD item route for negotiations (same read floor and writable fields as the collection route)
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { negotiations } from '@/db/schema';
import { NEGOTIATION_ROUTE_RULES } from '@/lib/bargaining/negotiation-route-rules';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: negotiations,
  pk: 'id',
  tags: ["Bargaining"],
  orgScoped: true,
  itemRoute: true,
  ...NEGOTIATION_ROUTE_RULES,
  writableFields: [...NEGOTIATION_ROUTE_RULES.writableFields],
});
export { GET, PATCH, DELETE };
