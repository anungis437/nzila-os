/**
 * CRUD item route for committees
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { committees } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: committees,
  pk: 'id',
  tags: ["Organization"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  // Internal notes and custom fields are the committee's working record, not a directory entry.
  omitFromResponse: ['notes', 'customFields'],
  writeRole: 'steward',
  // What CommitteeManagement's form sends (toCommitteePayload). status is free text with no governed lifecycle and the form sets it;
  // currentMemberCount is a number the form records, not one the server derives. The chair and secretary are set where people are chosen.
  // The notes go with a new committee only: an edit cannot show them, so it must not rewrite them.
  writableFields: ['name', 'committeeType', 'status', 'contactEmail', 'isOrganizationWide', 'unitId', 'worksiteId', 'meetingFrequency', 'meetingDay', 'meetingTime', 'meetingLocation', 'maxMembers', 'currentMemberCount', 'requiresAppointment', 'requiresElection', 'termLength', 'mandate', 'description'],
});
export { GET, PATCH, DELETE };
