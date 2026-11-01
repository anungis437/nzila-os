/**
 * CRUD collection route for analyticsMetrics
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { createdByJobsOnly } from '@/lib/api/computed-resource';
import { analyticsMetrics } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET } = crudRoutes({
  table: analyticsMetrics,
  pk: 'id',
  tags: ["Analytics"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
  entitlement: 'financial_intelligence_suite',
});
export { GET };
export const POST = createdByJobsOnly('Create analytics metric (not implemented)', 'Analytics metrics');
