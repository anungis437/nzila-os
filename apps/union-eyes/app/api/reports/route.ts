/**
 * CRUD collection route for reports
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { reports } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: reports,
  pk: 'id',
  tags: ["Analytics"],
  orgScoped: true,
  // A report definition names the data sources and filters it reads, and the registry executes only at an officer floor.
  readRole: 'steward',
  writableFields: ['name', 'description', 'reportType', 'category', 'config', 'templateId'],
  writeRole: 'steward',
});
export { GET, POST };
