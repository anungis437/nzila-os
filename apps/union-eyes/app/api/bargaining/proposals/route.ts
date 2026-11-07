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
  // Draft bargaining positions are confidential to those who bargain.
  readRole: 'steward',
  writeRole: 'steward',
  // The proposal's content and the bargainers' own costing estimate. Status, submitted/resolved dates and supersession follow the governed
  // lifecycle; the clause and parent-proposal references are not checked against the organization here, so they are not taken from a body.
  writableFields: ['negotiationId', 'proposalNumber', 'title', 'description', 'proposalType', 'clauseCategory', 'currentLanguage', 'proposedLanguage', 'rationale', 'estimatedCost', 'costingNotes', 'unionPosition', 'managementPosition', 'responseDeadline', 'attachments', 'internalNotes'],
});
export { GET, POST };
