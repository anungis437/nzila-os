/**
 * CRUD collection route for negotiations. Read floor, writable fields and the rationale are in
 * lib/bargaining/negotiation-route-rules.ts, shared with /api/negotiations.
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { negotiations } from '@/db/schema';
import { NEGOTIATION_ROUTE_RULES } from '@/lib/bargaining/negotiation-route-rules';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: negotiations,
  pk: 'id',
  tags: ["Bargaining"],
  orgScoped: true,
  ...NEGOTIATION_ROUTE_RULES,
  writableFields: [...NEGOTIATION_ROUTE_RULES.writableFields],
});
export { GET, POST };
