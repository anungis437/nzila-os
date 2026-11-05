/**
 * CRUD collection route for deadlines
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { deadlines } from '@/db/schema';
import { CLAIM_DEADLINE_DAY_FIELDS } from '@/lib/deadline-engine/deadline-day';
import { dayDeadlineFieldsAtEndOfDay } from '@/lib/deadline-engine/organization-time-zone';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: deadlines,
  pk: 'id',
  tags: ["Claims"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
  // A due date sent as a calendar day ("2026-03-04") falls due at 23:59 that day in the organization's zone; a datetime is kept as sent.
  beforeCreate: (values, { organizationId }) => dayDeadlineFieldsAtEndOfDay(values, CLAIM_DEADLINE_DAY_FIELDS, organizationId),
});
export { GET, POST };
