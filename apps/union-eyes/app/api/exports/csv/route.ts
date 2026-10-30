/**
 * GET POST /api/exports/csv
 *
 * Not implemented. This path advertises an operation of its own but was the generic CRUD factory over report definitions (no CSV is produced). It answered with that other behaviour as though
 * it were the operation, so it now answers HTTP 501 and changes and returns nothing.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Analytics'],
      summary: '/api/exports/csv (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/exports/csv is not implemented: it performed no operation of its own.');
  },
);

export const GET = handler;
export const POST = handler;
