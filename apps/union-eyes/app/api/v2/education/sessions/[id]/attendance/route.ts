/**
 * CRUD item route for trainingCourses
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { trainingCourses } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: trainingCourses,
  pk: 'id',
  tags: ["Scheduling"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
