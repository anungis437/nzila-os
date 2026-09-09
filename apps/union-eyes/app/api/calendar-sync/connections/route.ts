/**
 * CRUD collection route for externalCalendarConnections
 *
 * Round 56 fix: this table stores raw OAuth access/refresh tokens per
 * connecting user. `ownerColumn` restricts every operation to the caller's
 * own connection rows (org-scoping alone would let any org member read
 * every other member's tokens); `beforeCreate` force-stamps `userId` from
 * the authenticated caller so ownership can never be spoofed via the body.
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { externalCalendarConnections } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: externalCalendarConnections,
  pk: 'id',
  tags: ["Scheduling"],
  orgScoped: true,
  ownerColumn: 'userId',
  readRole: 'member',
  writeRole: 'steward',
  beforeCreate: (values, { userId }) => ({ ...values, userId }),
});
export { GET, POST };
