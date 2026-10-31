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
    return values;
  },
});
export { GET, POST };
