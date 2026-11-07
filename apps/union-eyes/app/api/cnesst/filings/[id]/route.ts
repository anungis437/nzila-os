/**
 * CNESST Filings — Item CRUD
 *
 * GET    /api/cnesst/filings/:id — get a single filing
 * PATCH  /api/cnesst/filings/:id — update a filing
 * DELETE /api/cnesst/filings/:id — delete a filing
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { cneesstFilings } from '@/db/schema';
import { filingLockedAuthCheck, filingRowReadable } from '@/lib/services/ohs-case-access';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: cneesstFilings,
  pk: 'id',
  tags: ['CNESST'],
  orgScoped: true,
  itemRoute: true,
  readRole: 'steward',
  writeRole: 'steward',
  // A steward reads or changes a filing only when case authority reaches its member (DEF-0B4-OHS-FILINGS-NO-CASE-AUTHORITY); otherwise it answers 404.
  rowReadAuthority: filingRowReadable,
  lockedAuthCheck: filingLockedAuthCheck,
  // The narrative and reference numbers a steward corrects. The member, type, status, lifecycle dates, outcome and compensation
  // are not changed through the generic PATCH.
  writableFields: [
    'title', 'description', 'descriptionFr', 'relief', 'reliefFr', 'legalBasis', 'filingDeadline', 'internalCaseNumber',
    'cneesstFileNumber', 'tatAppealNumber',
  ],
});
export { GET, PATCH, DELETE };
