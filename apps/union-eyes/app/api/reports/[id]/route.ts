/**
 * CRUD item route for reports
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { reports } from '@/db/schema';
import { eq, or } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: reports,
  pk: 'id',
  tags: ["Analytics"],
  orgScoped: true,
  itemRoute: true,
  // A report definition names the data sources and filters it reads, and the registry executes only at an officer floor.
  readRole: 'steward',
  writableFields: ['name', 'description', 'reportType', 'category', 'config', 'templateId'],
  writeRole: 'steward',
  // A definition its author kept private is read by its author only; a public one by anyone who may read definitions.
  readConditionFor: ({ userId }) => (userId ? or(eq(reports.isPublic, true), eq(reports.createdBy, userId)) : eq(reports.isPublic, true)),
});
export { GET, PATCH, DELETE };
