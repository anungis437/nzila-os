/**
 * /api/negotiations
 *
 * The same collection as /api/bargaining/negotiations. It was a second, identical crudRoutes configuration, so a role,
 * confidentiality or field restriction added to one path left the other open. Both paths now take their rules from
 * lib/bargaining/negotiation-route-rules.ts, so a restriction added once applies to both.
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
