/**
 * CRUD collection route for arbitrations
 *
 * An arbitration is part of a grievance, so creating one is an act on that case: the grievance must belong to the caller's organization
 * and the caller must be allowed to edit it by the case authority, not only hold a steward role.
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { assertOrganizationOwns } from '@/lib/api/org-references';
import { ApiError } from '@/lib/api/errors';
import { mayWriteArbitrationFor } from '@/lib/arbitration/arbitration-case-authority';
import { arbitrations, grievances } from '@/db/schema';
import { ARBITRATION_DEADLINE_DAY_FIELDS } from '@/lib/deadline-engine/deadline-day';
import { dayDeadlineFieldsAtEndOfDay } from '@/lib/deadline-engine/organization-time-zone';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: arbitrations,
  pk: 'id',
  tags: ["Organization"],
  orgScoped: true,
  readRole: 'steward',
  writeRole: 'steward',
  beforeCreate: async (values, { organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization context required');
    await assertOrganizationOwns([{ field: 'grievanceId', value: values.grievanceId, table: grievances }], organizationId);
    if (!(await mayWriteArbitrationFor({ organizationId, grievanceId: String(values.grievanceId), userId }))) {
      throw ApiError.forbidden('You do not hold this case');
    }
    // A deadline sent as a calendar day falls due at 23:59 that day in the organization's zone; a datetime is kept as sent.
    return dayDeadlineFieldsAtEndOfDay(values, ARBITRATION_DEADLINE_DAY_FIELDS, organizationId);
  },
});
export { GET, POST };
