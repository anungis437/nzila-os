/**
 * CRUD collection route for kpiConfigurations
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { kpiConfigurations } from '@/db/schema';
import { ApiError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: kpiConfigurations,
  pk: 'id',
  tags: ["Analytics"],
  orgScoped: true,
  readRole: 'member',
  // The alert recipients are user ids and email addresses of the staff who are notified.
  omitFromResponse: ['alertRecipients'],
  writeRole: 'steward',
  // What the KPI builder dialog sends. Recipients, refresh cadence, activation and layout are not set by it.
  writableFields: ['name', 'description', 'metricType', 'dataSource', 'calculation', 'visualizationType', 'targetValue', 'warningThreshold', 'criticalThreshold', 'alertEnabled'],
  // Nothing evaluates a KPI's thresholds or sends an alert, so a KPI may not claim one: the dialog sends alertEnabled: false.
  beforeCreate: (values) => {
    if (values.alertEnabled === true) throw ApiError.badRequest('KPI alerts are not implemented; alertEnabled must be false');
    return values;
  },
});
export { GET, POST };
