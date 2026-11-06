/**
 * CRUD item route for arbitrations
 *
 * Reading an arbitration needs the case authority's read verdict on its grievance. Changing an arbitration re-checks the case authority against the row loaded under the update's own lock; the grievance it belongs
 * to cannot be changed through this route.
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { arbitrationRowReadable, mayWriteArbitrationFor } from '@/lib/arbitration/arbitration-case-authority';
import { arbitrations } from '@/db/schema';
import { ARBITRATION_UPDATE_FIELDS } from '@/lib/arbitration/arbitration-fields';
import { ARBITRATION_DEADLINE_DAY_FIELDS } from '@/lib/deadline-engine/deadline-day';
import { dayDeadlineFieldsAtEndOfDay } from '@/lib/deadline-engine/organization-time-zone';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: arbitrations,
  pk: 'id',
  tags: ["Organization"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'steward',
  writeRole: 'steward',
  blockedPatchFields: ['grievanceId'],
  // A steward reads an arbitration only when the case authority lets them read its grievance; otherwise it answers 404.
  rowReadAuthority: arbitrationRowReadable,
  // The proceeding's record, changed only by someone the case authority lets edit the case (lockedAuthCheck under the update lock).
  writableFields: ARBITRATION_UPDATE_FIELDS,
  // An arbitration is part of the case record: it is never removed through the generic route. A withdrawn or settled arbitration is
  // recorded through its status by the case holder, so DELETE answers 409 before any row is read, for every caller.
  retainOnDelete: true,
  lockedAuthCheck: async (existing, { organizationId, userId }) => {
    if (!organizationId || !userId || typeof existing.grievanceId !== 'string') return { ok: false, status: 403 };
    return (await mayWriteArbitrationFor({ organizationId, grievanceId: existing.grievanceId, userId })) ? { ok: true } : { ok: false, status: 403 };
  },
  // A deadline sent as a calendar day falls due at 23:59 that day in the organization's zone; a datetime is kept as sent.
  beforeUpdate: (updates, { organizationId }) => dayDeadlineFieldsAtEndOfDay(updates, ARBITRATION_DEADLINE_DAY_FIELDS, organizationId),
});
export { GET, PATCH, DELETE };
