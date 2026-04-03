/**
 * CRUD collection route for trainingPrograms
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { trainingPrograms } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: trainingPrograms,
  pk: 'id',
  tags: ["Scheduling"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'officer',
});
export { GET, POST };
