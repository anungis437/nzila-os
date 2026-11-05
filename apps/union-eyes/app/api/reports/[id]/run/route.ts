/**
 * GET PATCH DELETE /api/reports/:id/run
 *
 * Not implemented. This path advertises an operation of its own but was the generic CRUD factory over report definitions (a report row; nothing is run and its DELETE removed the report). It answered with that other behaviour as though
 * it were the operation, so it now answers HTTP 501 and changes and returns nothing.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Analytics'],
      summary: '/api/reports/:id/run (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/reports/:id/run is not implemented: it performed no operation of its own.');
  },
);

export const GET = handler;
export const PATCH = handler;
export const DELETE = handler;
