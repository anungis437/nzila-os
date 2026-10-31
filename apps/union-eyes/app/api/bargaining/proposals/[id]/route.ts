/**
 * CRUD item route for bargainingProposals
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { bargainingProposals, negotiations } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: bargainingProposals,
  pk: 'id',
  tags: ["Bargaining"],
  orgScoped: true,
  // bargaining_proposals has no organization column: it belongs to a negotiation, and the negotiation belongs to the organization.
  parentScope: { column: 'negotiationId', parent: negotiations },
  itemRoute: true,
  // Draft bargaining positions are confidential to those who bargain.
  readRole: 'steward',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
