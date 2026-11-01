/**
 * CRUD collection route for trendAnalyses
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
export const POST = createdByJobsOnly('Create trend analyse (not implemented)', 'Trend analyses');
