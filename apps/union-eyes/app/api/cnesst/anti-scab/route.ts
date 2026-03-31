/**
 * Anti-Scab Violations — Collection CRUD
 *
 * Code du travail art. 109.1: prohibition of replacement workers during strikes/lockouts
 *
 * GET  /api/cnesst/anti-scab — list violations for the org
 * POST /api/cnesst/anti-scab — report a new violation (steward+)
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { antiScabViolations } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: antiScabViolations,
  pk: 'id',
  tags: ['CNESST', 'Anti-Scab'],
  orgScoped: true,
  readRole: 'steward',
  writeRole: 'steward',
});
export { GET, POST };
