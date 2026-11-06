/**
 * Anti-Scab Violations — Collection CRUD
 *
 * Code du travail art. 109.1: prohibition of replacement workers during strikes/lockouts
 *
 * GET  /api/cnesst/anti-scab — list the violations the caller filed (see lib/services/anti-scab-access.ts)
 * POST /api/cnesst/anti-scab — report a new violation (steward+)
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { antiScabViolations } from '@/db/schema';
import { antiScabAuthorCondition } from '@/lib/services/anti-scab-access';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: antiScabViolations,
  pk: 'id',
  tags: ['CNESST', 'Anti-Scab'],
  orgScoped: true,
  readRole: 'steward',
  writeRole: 'steward',
  // A steward role is not authority over every violation file: the list holds the caller's own filings only (fail closed until the
  // institutional authority over these records is decided).
  readConditionFor: ({ userId }) => antiScabAuthorCondition(userId),
  // The author is the session user (the factory stamps createdBy); the reporter columns are not the caller's to assert, and a
  // resolution, a penalty or a tribunal filing is not stated at the time a violation is reported.
  writableFields: [
    'strikeOrLockoutStartDate', 'isStrike', 'bargainingUnitDescription', 'violationType', 'violationDate', 'description',
    'descriptionFr', 'evidenceSummary', 'replacementWorkerCount',
  ],
});
export { GET, POST };
