/**
 * GET POST /api/organizing/workplace-mapping
 *
 * Not implemented. This path advertises an operation of its own but was the generic CRUD factory over organizing_campaigns (no workplace is mapped). It answered with that other behaviour as though
 * it were the operation, so it now answers HTTP 501 and changes and returns nothing.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    openapi: {
      tags: ['Organization'],
      summary: '/api/organizing/workplace-mapping (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/organizing/workplace-mapping is not implemented: it performed no operation of its own.');
  },
);

export const GET = handler;
export const POST = handler;
