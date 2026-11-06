/**
 * CRUD collection route for safetyInspections
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { safetyInspections } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: safetyInspections,
  tags: ["Health-safety"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'admin',
  // Scheduling an inspection (no screen posts here; InspectionReportViewer only reads). Status, results, counts, score and
  // follow-up completion are produced by conducting the inspection, not by the create body.
  writableFields: [
    'inspectionType', 'scheduledDate', 'dueDate', 'workplaceName', 'areasInspected', 'specificLocation', 'leadInspectorName',
    'inspectorNames', 'inspectionScope', 'checklistUsed', 'regulatoryRequirement', 'regulatoryAgency', 'regulatoryReference',
    'notes',
  ],
});
export { GET, POST };
