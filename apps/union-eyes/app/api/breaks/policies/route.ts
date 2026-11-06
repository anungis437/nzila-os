/**
 * Break Policies — Collection CRUD
 *
 * GET  /api/breaks/policies — list break policies for the org
 * POST /api/breaks/policies — create a new break policy (steward+)
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { breakPolicies } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: breakPolicies,
  pk: 'id',
  tags: ["Breaks"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
  // The policy's terms (no screen posts here). The active flag and metadata are not set through the generic route.
  writableFields: [
    'name', 'breakType', 'compensation', 'durationMinutes', 'frequencyPerShift', 'minHoursForEligibility', 'maxHoursBetween',
    'applicableShiftType', 'cbaClauseRef', 'notes',
  ],
});
export { GET, POST };
