/**
 * Anti-Scab Violations — Item CRUD
 *
 * GET    /api/cnesst/anti-scab/:id
 * PATCH  /api/cnesst/anti-scab/:id
 * DELETE /api/cnesst/anti-scab/:id
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { antiScabViolations } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: antiScabViolations,
  pk: 'id',
  tags: ['CNESST', 'Anti-Scab'],
  orgScoped: true,
  itemRoute: true,
  retainOnDelete: true,
  readRole: 'steward',
  writeRole: 'steward',
  // Authorship and the reporter are fixed when the violation is filed.
  blockedPatchFields: ['createdBy', 'reportedById', 'reportedByName'],
  // Facts a steward records as the violation is pursued. Tribunal outcomes (injunction granted, penalty, resolution), the derived
  // day count, documents and metadata are not set through the generic PATCH.
  writableFields: [
    'strikeOrLockoutStartDate', 'isStrike', 'bargainingUnitDescription', 'violationType', 'violationDate', 'description',
    'descriptionFr', 'evidenceSummary', 'replacementWorkerCount', 'tatComplaintFiled', 'tatComplaintDate', 'tatFileNumber',
    'injunctionRequested',
  ],
});
export { GET, PATCH, DELETE };
