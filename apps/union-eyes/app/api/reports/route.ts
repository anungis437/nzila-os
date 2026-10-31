/**
 * CRUD collection route for reports
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { reports } from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import { ApiError } from '@/lib/api/framework';
import { validateStoredReportConfig } from '@/lib/reports/report-config-validation';

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
  // A definition is checked against the executor's contract when it is saved, not when it first fails to run.
  beforeCreate: (values) => {
    const problem = validateStoredReportConfig(values.config);
    if (problem) throw ApiError.badRequest(`Invalid report configuration: ${problem}`);
    return values;
  },
  // A definition its author kept private is read by its author only; a public one by anyone who may read definitions.
  readConditionFor: ({ userId }) => (userId ? or(eq(reports.isPublic, true), eq(reports.createdBy, userId)) : eq(reports.isPublic, true)),
});
export { GET, POST };
