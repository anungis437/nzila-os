/**
 * GET POST /api/ml/monitoring/alerts
 *
 * Not implemented. This path advertises an operation of its own but was a query over columns and a table that do not exist, plus a fixed drift alert (PSI 0.28) that was stated whenever an organization had enough claims. It answered with that other behaviour as though
 * it were the operation, so it now answers HTTP 501 and changes and returns nothing.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Not implemented'],
      summary: '/api/ml/monitoring/alerts (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/ml/monitoring/alerts is not implemented: it performed no operation of its own.');
  },
);

export const GET = handler;
export const POST = handler;
