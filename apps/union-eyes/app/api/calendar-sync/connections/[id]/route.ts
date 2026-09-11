/**
 * CRUD item route for externalCalendarConnections
 *
 * Round 56 fix: `ownerColumn` restricts GET/PATCH/DELETE to the caller's
 * own connection row — see the collection route for why (raw OAuth
 * tokens; org-scoping alone is not sufficient).
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { externalCalendarConnections } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: externalCalendarConnections,
  pk: 'id',
  tags: ["Scheduling"],
  orgScoped: true,
  ownerColumn: 'userId',
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
