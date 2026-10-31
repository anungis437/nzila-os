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
  // The author is the session user (the factory stamps createdBy); the reporter columns are not the caller's to assert, and a
  // resolution, a penalty or a tribunal filing is not stated at the time a violation is reported.
  writableFields: [
    'strikeOrLockoutStartDate', 'isStrike', 'bargainingUnitDescription', 'violationType', 'violationDate', 'description',
    'descriptionFr', 'evidenceSummary', 'replacementWorkerCount',
  ],
});
export { GET, POST };
