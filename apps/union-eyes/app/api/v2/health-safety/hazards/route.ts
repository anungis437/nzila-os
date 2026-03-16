/**
 * CRUD collection route for hazardReports
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { hazardReports } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: hazardReports,
  tags: ["Health-safety"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'admin',
});
export { GET, POST };
