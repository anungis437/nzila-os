/**
 * CRUD collection route for bargainingProposals
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { bargainingProposals, negotiations } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: bargainingProposals,
  pk: 'id',
  tags: ["Bargaining"],
  orgScoped: true,
  // bargaining_proposals has no organization column: it belongs to a negotiation, and the negotiation belongs to the organization.
  parentScope: { column: 'negotiationId', parent: negotiations },
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
