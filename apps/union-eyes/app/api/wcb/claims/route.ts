/**
 * WCB Claims — Collection CRUD
 *
 * GET  /api/wcb/claims — list WCB claims for the org
 * POST /api/wcb/claims — create a new claim (steward+)
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { wcbClaims } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: wcbClaims,
  pk: 'id',
  tags: ['WCB'],
  orgScoped: true,
  ownerColumn: 'workerId',
  readRole: 'steward',
  writeRole: 'steward',
});
export { GET, POST };
