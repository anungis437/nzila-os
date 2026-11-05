/**
 * CRUD collection route for trendAnalyses.
 *
 * It used to read analyticsMetrics (a copy of the metrics route), so the dashboard's trend list received metric rows with none of the
 * trend fields (detectedTrend, confidence, anomalyCount, insights).
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { createdByJobsOnly } from '@/lib/api/computed-resource';
import { trendAnalyses } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET } = crudRoutes({
  table: trendAnalyses,
  pk: 'id',
  tags: ["Analytics"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET };
export const POST = createdByJobsOnly('Create trend analysis (not implemented)', 'Trend analyses');
