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
  // A steward files on behalf of the member the filing concerns, so staff name the member on create; the member column is otherwise server-owned.
  staffMayNameOwner: true,
  readRole: 'steward',
  writeRole: 'steward',
  // What a steward states when opening a filing for a member: filedDate is the submission fact the steward is recording, not an
  // external body's decision. CNESST/TAT numbers, acknowledged/decision dates, outcome, compensation, the union representative and
  // links to other records are not a create field.
  writableFields: [
    'memberId', 'filingType', 'title', 'description', 'descriptionFr', 'relief', 'reliefFr', 'legalBasis', 'filingDeadline',
    'internalCaseNumber', 'filedDate',
  ],
});
export { GET, POST };
