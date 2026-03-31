/**
 * Joint H&S Committees — Collection CRUD
 *
 * LSST art. 68–86: comité de santé et de sécurité
 *
 * GET  /api/cnesst/hs-committees — list committees for the org
 * POST /api/cnesst/hs-committees — register a new committee (officer+)
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { jointHsCommittees } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: jointHsCommittees,
  pk: 'id',
  tags: ['CNESST', 'H&S Committee'],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'officer',
});
export { GET, POST };
