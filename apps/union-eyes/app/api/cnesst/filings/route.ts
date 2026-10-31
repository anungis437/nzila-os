/**
 * CNESST Filings — Collection CRUD
 *
 * GET  /api/cnesst/filings — list CNESST filings for the org
 * POST /api/cnesst/filings — create a new filing (steward+)
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { cneesstFilings } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: cneesstFilings,
  pk: 'id',
  tags: ['CNESST'],
  orgScoped: true,
  ownerColumn: 'memberId',
  // The collection is a steward read: the owner scope applies below that floor, as the item route does, so staff see the organization's filings.
  staffReadsAll: true,
  readRole: 'steward',
  writeRole: 'steward',
});
export { GET, POST };
