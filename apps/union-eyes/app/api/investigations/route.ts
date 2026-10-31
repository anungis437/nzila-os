/**
 * GET POST /api/investigations
 *
 * Not implemented. This path advertises an operation of its own but was an alias of the case collection (no investigation record exists, and a create made a case). It answered with that other behaviour as though
 * it were the operation, so it now answers HTTP 501 and changes and returns nothing.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Not implemented'],
      summary: '/api/investigations (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/investigations is not implemented: it performed no operation of its own.');
  },
);

export const GET = handler;
export const POST = handler;
