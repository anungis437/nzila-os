/**
 * CNESST Filings — Item CRUD
 *
 * GET    /api/cnesst/filings/:id — get a single filing
 * PATCH  /api/cnesst/filings/:id — update a filing
 * DELETE /api/cnesst/filings/:id — delete a filing
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { cneesstFilings } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: cneesstFilings,
  pk: 'id',
  tags: ['CNESST'],
  orgScoped: true,
  itemRoute: true,
  readRole: 'steward',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
