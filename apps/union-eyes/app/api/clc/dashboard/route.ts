/**
 * GET POST /api/clc/dashboard
 *
 * Not implemented. This path advertises an operation of its own but was the generic CRUD factory over clc_sync_log (sync log rows under a dashboard name; nothing is aggregated). It answered with that other behaviour as though
 * it were the operation, so it now answers HTTP 501 and changes and returns nothing.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Billing'],
      summary: '/api/clc/dashboard (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/clc/dashboard is not implemented: it performed no operation of its own.');
  },
);

export const GET = handler;
export const POST = handler;
