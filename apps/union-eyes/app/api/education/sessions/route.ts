/**
 * CRUD collection route for courseSessions
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { courseSessions } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: courseSessions,
  pk: 'id',
  tags: ["Scheduling"],
  orgScoped: true,
  readRole: 'member',
  // The access code and the budget and actual cost are for staff; the factory has no per-role column view, so no one reads them here.
  omitFromResponse: ['virtualMeetingAccessCode', 'sessionBudget', 'actualCost'],
  writeRole: 'steward',
});
export { GET, POST };
