/**
 * API Route: Ingestion Batch Detail
 * GET /api/admin/ingest/batches/[id]
 *
 * Returns full batch detail with per-record status and quality warnings.
 * Powers the Migration Detail View (§2).
 */

import { withApi, ApiError } from '@/lib/api/framework';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { getBatchDetail } from '@/lib/ingestion/migration-metrics';

export const GET = withApi(
  {
    auth: { minRole: 'admin' },
    openapi: {
      tags: ['Admin', 'Ingestion'],
      summary: 'Get ingestion batch detail',
      description: 'Returns full batch detail including per-record results and quality warnings.',
    },
  },
  async ({ params, organizationId }) => {
    if (!organizationId) {
      throw ApiError.badRequest('Organization context required');
    }

    const batchId = params.id;
    if (!batchId) {
      throw ApiError.badRequest('Batch ID is required');
    }

    const detail = await withSystemContext(async () =>
      getBatchDetail(batchId, organizationId),
    );

    if (!detail) {
      throw ApiError.notFound('Batch not found');
    }

    return detail as any as Record<string, unknown>;
  },
);
