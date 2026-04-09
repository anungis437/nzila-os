/**
 * API Route: List Ingestion Batches
 * GET /api/admin/ingest/batches
 *
 * Returns paginated batch list with summary metrics.
 * Powers the Migration Observability Dashboard (§1).
 */

import { withApi, z, ApiError } from '@/lib/api/framework';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { listBatches, getMetricsSummary } from '@/lib/ingestion/migration-metrics';

const querySchema = z.object({
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const GET = withApi(
  {
    auth: { minRole: 'admin' },
    query: querySchema,
    openapi: {
      tags: ['Admin', 'Ingestion'],
      summary: 'List ingestion batches',
      description: 'Returns paginated list of migration batches with aggregate metrics.',
    },
  },
  async ({ query, organizationId }) => {
    if (!organizationId) {
      throw ApiError.badRequest('Organization context required');
    }

    const [batchResult, metrics] = await withSystemContext(async () =>
      Promise.all([
        listBatches(organizationId, {
          status: query.status,
          limit: query.limit,
          offset: query.offset,
        }),
        getMetricsSummary(organizationId),
      ]),
    );

    return {
      ...batchResult,
      metrics,
    };
  },
);
