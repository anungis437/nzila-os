/**
 * CRUD collection route for trainingCourses
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { eq } from 'drizzle-orm';
import { trainingCourses } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: trainingCourses,
  pk: 'id',
  tags: ["Scheduling"],
  orgScoped: true,
  readRole: 'member',
  // The table holds drafts and archived courses (isActive false) beside the live catalogue; a member reads only the live ones.
  belowStaffReadCondition: eq(trainingCourses.isActive, true),
  writeRole: 'steward',
});
export { GET, POST };
