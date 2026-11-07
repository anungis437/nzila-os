/**
 * GET POST /api/currency/convert
 *
 * Not implemented. This path advertises a currency conversion operation but was the generic CRUD factory over analyticsMetrics: GET
 * returned analytics-metric rows under this name and every write was refused, so nothing it advertises was ever done. It answers
 * HTTP 501 rather than present an unrelated table's rows as that operation. Recording a metric is served by /api/metrics.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Analytics'],
      summary: '/api/currency/convert (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/currency/convert is not implemented: it performed no operation of its own and returned analytics-metric rows instead.');
  },
);

export const GET = handler;
export const POST = handler;

