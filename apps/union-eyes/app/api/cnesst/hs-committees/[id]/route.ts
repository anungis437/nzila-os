/**
 * Joint H&S Committees — Item CRUD
 *
 * GET    /api/cnesst/hs-committees/:id
 * PATCH  /api/cnesst/hs-committees/:id
 * DELETE /api/cnesst/hs-committees/:id
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { jointHsCommittees } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: jointHsCommittees,
  pk: 'id',
  tags: ['CNESST', 'H&S Committee'],
  orgScoped: true,
  itemRoute: true,
  retainOnDelete: true,
  // The roster names the worker and employer members of the committee.
  readRole: 'steward',
  writeRole: 'officer',
  // The committee's composition and schedule. Program approvals, the meeting counter, the active flag, documents and the
  // uuid links (workplace, worker co-chair) are not set through the generic route.
  writableFields: [
    'workplaceName', 'committeeName', 'establishedDate', 'mandateExpiryDate', 'workerRepresentatives', 'employerRepresentatives',
    'workerCoChairName', 'employerCoChairName', 'meetingFrequency', 'lastMeetingDate', 'nextMeetingDate', 'workplaceWorkerCount',
    'isMandatory', 'notes',
  ],
});
export { GET, PATCH, DELETE };
